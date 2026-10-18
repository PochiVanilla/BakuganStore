import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  auctionFulfillments,
  cardPayments,
  couponRedemptions,
  coupons,
  items,
  orderEvents,
  orders,
  paymentAttempts,
} from '../../db/schema';
import { withTransaction, type Tx } from '../../db/tx';
import { conflict } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { CARD_HOLD_MINUTES } from '../../shared/orders';
import type { CancelReason, OrderStatus } from '../../shared/types';
import type { FeedCatalog } from '../catalog/store';
import { lockOrder, type OrderRow } from './store';

/*
 * Thay đổi đơn hàng dùng chung cho mọi nơi (khách đặt / huỷ, admin, cổng thanh toán,
 * việc chạy nền) — để trạng thái SOLD của từng con, lượt mã giảm giá và lịch sử đơn luôn
 * được cập nhật cùng một cách. Luôn gọi bên trong transaction đã khoá dòng đơn.
 */

export interface Actor {
  type: 'customer' | 'admin' | 'system' | 'gateway';
  id?: string | null;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { type: 'system', name: 'Hệ thống' };
export const GATEWAY_ACTOR: Actor = { type: 'gateway', name: 'Cổng thanh toán' };

export function customerActor(userId: string): Actor {
  return { type: 'customer', id: userId, name: 'Khách hàng' };
}

export function adminActor(user: { id: string; fullName: string }): Actor {
  return { type: 'admin', id: user.id, name: user.fullName };
}

/** Thêm một mốc vào lịch sử đơn (không đổi trạng thái). */
export async function addEvent(
  tx: Tx,
  orderId: string,
  status: OrderStatus,
  actor: Actor,
  note?: string,
  at: Date = new Date(),
): Promise<void> {
  await tx.insert(orderEvents).values({
    id: newId(),
    orderId,
    status,
    at,
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorName: actor.name,
    note: note ? note.slice(0, 1000) : null,
  });
}

/** Đổi trạng thái đơn kèm một mốc lịch sử. */
export async function recordStatus(
  tx: Tx,
  orderId: string,
  status: OrderStatus,
  actor: Actor,
  note?: string,
  at: Date = new Date(),
): Promise<void> {
  await tx.update(orders).set({ status }).where(eq(orders.id, orderId));
  await addEvent(tx, orderId, status, actor, note, at);
}

/** Những con trong đơn chuyển sang SOLD, gắn với đơn này, ghi lại tên / số feed lúc bán. */
export async function sellItems(
  tx: Tx,
  orderId: string,
  itemIds: readonly string[],
  at: Date,
): Promise<void> {
  if (itemIds.length === 0) return;
  await tx
    .update(items)
    .set({
      status: 'sold',
      soldVia: 'order',
      orderId,
      soldAt: at,
      soldNote: null,
      buyerName: null,
    })
    .where(inArray(items.id, [...itemIds]));
  await tx.execute(sql`
    UPDATE items JOIN feeds ON feeds.id = items.feed_id
    SET items.feed_title_snapshot = feeds.title, items.feed_number_snapshot = feeds.number
    WHERE items.id IN (${sql.join(
      itemIds.map((id) => sql`${id}`),
      sql`, `,
    )})`);
}

/**
 * Trả những con thuộc đơn về trạng thái còn bán (đơn huỷ, hoặc hàng hoàn trả bán lại được).
 * Con đã bị đơn khác hay admin xử lý thì không đụng tới. Trả về số con được mở bán lại.
 */
export async function releaseItems(tx: Tx, orderId: string): Promise<number> {
  const [result] = await tx
    .update(items)
    .set({ status: 'available', soldAt: null, soldVia: null, orderId: null })
    .where(and(eq(items.orderId, orderId), eq(items.status, 'sold')));
  return result.affectedRows;
}

/** Trả lại lượt dùng mã giảm giá của đơn (đơn huỷ). */
export async function releaseCoupon(tx: Tx, orderId: string, at: Date): Promise<void> {
  const [redemption] = await tx
    .select()
    .from(couponRedemptions)
    .where(and(eq(couponRedemptions.orderId, orderId), isNull(couponRedemptions.releasedAt)))
    .for('update');
  if (!redemption) return;
  await tx
    .update(couponRedemptions)
    .set({ releasedAt: at })
    .where(eq(couponRedemptions.id, redemption.id));
  await tx
    .update(coupons)
    .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
    .where(eq(coupons.code, redemption.couponCode));
}

/** Đóng các lượt trả thẻ còn mở (khách đổi cách trả, đơn huỷ, mở phiên mới). */
export async function closeOpenAttempts(tx: Tx, orderId: string, at: Date): Promise<void> {
  await tx
    .update(paymentAttempts)
    .set({ status: 'closed', finishedAt: at })
    .where(and(eq(paymentAttempts.orderId, orderId), eq(paymentAttempts.status, 'open')));
}

/**
 * Huỷ một đơn chưa rời shop: những con trong đơn được bán lại, trả lượt mã giảm giá,
 * đóng lượt trả thẻ đang mở, ghi lý do; đơn đấu giá thì phiên thành "bỏ cọc".
 * Trả về số con được mở bán lại (để biết có cần xoá bộ đệm feed không).
 */
export async function cancelOrder(
  tx: Tx,
  order: OrderRow,
  input: { reason: CancelReason; note?: string; actor: Actor; eventNote?: string; at?: Date },
): Promise<number> {
  const at = input.at ?? new Date();
  const released = await releaseItems(tx, order.id);
  await releaseCoupon(tx, order.id, at);
  await closeOpenAttempts(tx, order.id, at);
  await tx
    .update(orders)
    .set({ cancelReason: input.reason, cancelNote: input.note?.slice(0, 500) || null })
    .where(eq(orders.id, order.id));
  if (order.auctionId) {
    await tx
      .update(auctionFulfillments)
      .set({ status: 'forfeited', note: 'Đơn đấu giá đã bị huỷ.' })
      .where(eq(auctionFulfillments.auctionId, order.auctionId));
  }
  await recordStatus(tx, order.id, 'cancelled', input.actor, input.eventNote ?? input.note, at);
  return released;
}

/* ---------------- Giữ hàng chờ trả thẻ ---------------- */

/** Khách có thể đang nhập OTP ở cổng: lượt mở trong ngần này phút thì chưa huỷ đơn. */
export const OPEN_ATTEMPT_GRACE_MINUTES = 20;

/** Đơn trả thẻ, còn chờ xác nhận, chưa trả và đã quá hạn giữ hàng. */
export function cardHoldExpired(
  order: Pick<OrderRow, 'paymentMethod' | 'paymentStatus' | 'status'>,
  expiresAt: Date | undefined,
  now: number,
): boolean {
  return (
    order.paymentMethod === 'card' &&
    order.paymentStatus === 'unpaid' &&
    order.status === 'pending' &&
    expiresAt !== undefined &&
    expiresAt.getTime() <= now
  );
}

export const MY_ORDER_NOT_FOUND = 'Không tìm thấy đơn hàng này trong tài khoản của bạn.';

/** Còn trả bằng thẻ được không — nếu không thì báo lý do (đúng câu của web). */
export function assertCardPayable(order: OrderRow, expiresAt: Date | undefined, now = Date.now()) {
  if (order.paymentMethod !== 'card') throw conflict('Đơn này không trả bằng thẻ.');
  if (order.paymentStatus === 'paid') throw conflict('Đơn này đã được thanh toán rồi.');
  if (order.status !== 'pending' || cardHoldExpired(order, expiresAt, now)) {
    throw conflict('Đơn này đã huỷ vì quá hạn thanh toán — các con Bakugan đã được mở bán lại.');
  }
}

/** Có lượt trả thẻ còn mở được tạo gần đây không (khách đang ở trang cổng). */
async function hasRecentOpenAttempt(executor: Db | Tx, orderId: string, now: Date) {
  const since = new Date(now.getTime() - OPEN_ATTEMPT_GRACE_MINUTES * 60_000);
  const [row] = await executor
    .select({ id: paymentAttempts.id })
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.orderId, orderId),
        eq(paymentAttempts.status, 'open'),
        gt(paymentAttempts.createdAt, since),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Huỷ các đơn quá hạn trả thẻ, mở bán lại những con trong đó. Mỗi đơn một transaction riêng,
 * khoá dòng đơn rồi kiểm tra lại (cổng có thể vừa báo đã trả). Trả về số đơn đã huỷ.
 */
export async function expireCardHolds(
  deps: { db: Db; catalog: FeedCatalog; logger: Logger },
  now: Date = new Date(),
): Promise<number> {
  const candidates = await deps.db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(cardPayments, eq(cardPayments.orderId, orders.id))
    .where(
      and(
        eq(orders.paymentMethod, 'card'),
        eq(orders.status, 'pending'),
        eq(orders.paymentStatus, 'unpaid'),
        lte(cardPayments.expiresAt, now),
      ),
    )
    .limit(200);
  let expired = 0;
  for (const { id } of candidates) {
    try {
      const done = await withTransaction(deps.db, async (tx) => {
        const order = await lockOrder(tx, id);
        const [card] = await tx
          .select({ expiresAt: cardPayments.expiresAt })
          .from(cardPayments)
          .where(eq(cardPayments.orderId, id));
        if (!order || !cardHoldExpired(order, card?.expiresAt, now.getTime())) return false;
        if (await hasRecentOpenAttempt(tx, id, now)) return false;
        await cancelOrder(tx, order, {
          reason: 'payment-timeout',
          note: 'Quá hạn thanh toán thẻ.',
          actor: SYSTEM_ACTOR,
          eventNote: `Quá ${CARD_HOLD_MINUTES} phút chưa thanh toán thẻ — đơn tự huỷ, các con Bakugan được mở bán lại.`,
          at: now,
        });
        return true;
      });
      if (done) expired += 1;
    } catch (error) {
      deps.logger.error({ err: error, orderId: id }, 'Không huỷ được đơn quá hạn trả thẻ');
    }
  }
  if (expired > 0) {
    deps.catalog.invalidate();
    deps.logger.info({ expired }, 'Đã huỷ đơn quá hạn trả thẻ, mở bán lại hàng');
  }
  return expired;
}

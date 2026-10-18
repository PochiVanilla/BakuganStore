import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  cardPayments,
  couponRedemptions,
  coupons,
  items,
  orderIssues,
  orderItems,
  orders,
  paymentAttempts,
  paymentEvents,
  refunds,
} from '../../db/schema';
import { duplicateKeyName, withTransaction, type Tx } from '../../db/tx';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { describeCard, formatCurrency } from '../../shared/orders';
import type { CardBrand } from '../../shared/types';
import type { FeedCatalog } from '../catalog/store';
import {
  addEvent,
  assertCardPayable,
  closeOpenAttempts,
  expireCardHolds,
  GATEWAY_ACTOR,
  MY_ORDER_NOT_FOUND,
  recordStatus,
  sellItems,
  SYSTEM_ACTOR,
  type Actor,
} from '../orders/mutations';
import { lockCardPayment, lockOrder, type OrderRow } from '../orders/store';
import type { CardGateway, GatewayCallback } from './gateway';

/*
 * Thanh toán thẻ (kế hoạch 8.9). Luật quan trọng nhất: HỆ THỐNG KHÔNG BAO GIỜ TỰ HOÀN TIỀN.
 * Tiền về mà đơn không nhận được (trả trễ khi hàng đã bán cho người khác, trả trùng, trả cho
 * lượt đã đóng, sai số tiền) → ghi nhận khoản tiền + mở sự cố tiền cho admin tự quyết.
 */

export interface PaymentDeps {
  db: Db;
  catalog: FeedCatalog;
  logger: Logger;
  /** Cổng đang dùng; `null` = chưa có cổng (bản thật chưa ký hợp đồng) */
  gateway: CardGateway | null;
  /** Origin được phép làm trang quay về sau khi trả (web của shop) */
  allowedOrigins: readonly string[];
}

export const CARD_OFF_MESSAGE = 'Shop đang tạm ngưng nhận thanh toán thẻ — bạn chọn cách khác nhé.';

function requireGateway(deps: PaymentDeps): CardGateway {
  if (!deps.gateway) throw conflict(CARD_OFF_MESSAGE);
  return deps.gateway;
}

/* ---------------- Mở phiên trả ---------------- */

/**
 * POST /payments/card/sessions: đúng chủ đơn, đơn thẻ còn chờ trả và còn hạn giữ hàng.
 * Số tiền lấy từ đơn trong CSDL. Lượt cũ còn mở bị đóng; trả về link trang trả tiền của cổng.
 */
export async function openCardSession(
  deps: PaymentDeps,
  userId: string,
  orderId: string,
  returnUrl: string,
): Promise<{ redirectUrl: string }> {
  const gateway = requireGateway(deps);
  let origin: string | undefined;
  try {
    origin = new URL(returnUrl).origin;
  } catch {
    origin = undefined;
  }
  // Không cho lợi dụng để chuyển khách sang trang lạ sau khi trả tiền.
  if (!origin || !deps.allowedOrigins.includes(origin)) {
    throw unprocessable('Đường dẫn quay lại sau khi thanh toán không hợp lệ.');
  }
  await expireCardHolds(deps);
  const attempt = await withTransaction(deps.db, async (tx) => {
    const order = await lockOrder(tx, orderId, userId);
    if (!order) throw notFound(MY_ORDER_NOT_FOUND);
    const card = await lockCardPayment(tx, order.id);
    assertCardPayable(order, card?.expiresAt);
    if (order.total <= 0) throw conflict('Đơn này không cần thanh toán.');
    const at = new Date();
    await closeOpenAttempts(tx, order.id, at);
    const id = newId();
    await tx.insert(paymentAttempts).values({
      id,
      orderId: order.id,
      gateway: gateway.name,
      amount: order.total,
      status: 'open',
      createdAt: at,
    });
    return { id, orderId: order.id, amount: order.total };
  });
  return gateway.createPayment({
    attemptId: attempt.id,
    orderId: attempt.orderId,
    amount: attempt.amount,
  });
}

/* ---------------- Cổng báo kết quả (IPN) ---------------- */

export type CallbackOutcome =
  | 'paid'
  | 'late-paid-kept'
  | 'money-issue'
  | 'failed'
  | 'already-processed'
  | 'amount-mismatch'
  | 'unknown-attempt'
  | 'bad-signature';

/** Câu trả lời cho cổng (theo kiểu VNPAY: RspCode / Message) */
const RESPONSE: Record<CallbackOutcome, { RspCode: string; Message: string }> = {
  paid: { RspCode: '00', Message: 'Confirm Success' },
  'late-paid-kept': { RspCode: '00', Message: 'Confirm Success' },
  'money-issue': { RspCode: '00', Message: 'Confirm Success' },
  failed: { RspCode: '00', Message: 'Confirm Success' },
  'already-processed': { RspCode: '02', Message: 'Order already confirmed' },
  'amount-mismatch': { RspCode: '04', Message: 'Invalid amount' },
  'unknown-attempt': { RspCode: '01', Message: 'Order not found' },
  'bad-signature': { RspCode: '97', Message: 'Invalid signature' },
};

export function gatewayResponse(outcome: CallbackOutcome) {
  return RESPONSE[outcome];
}

/** Dữ liệu cổng gửi, bỏ chữ ký trước khi lưu (không bao giờ có số thẻ đầy đủ). */
function sanitize(params: Record<string, string>): Record<string, string> {
  const { signature: _signature, ...rest } = params;
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, value.slice(0, 255)]));
}

function cardLabel(brand?: CardBrand, last4?: string): string {
  return describeCard({ expiresAt: '', attempts: 0, brand, last4 });
}

async function openMoneyIssue(
  tx: Tx,
  order: OrderRow,
  attemptId: string,
  description: string,
): Promise<void> {
  await tx.insert(orderIssues).values({
    id: newId(),
    orderId: order.id,
    type: 'payment',
    status: 'open',
    description,
    reportedBy: 'system',
    paymentAttemptId: attemptId,
  });
}

async function markCardPaid(tx: Tx, orderId: string, callback: GatewayCallback, at: Date) {
  await tx
    .update(cardPayments)
    .set({
      attempts: sql`${cardPayments.attempts} + 1`,
      brand: callback.brand ?? null,
      last4: callback.last4 ?? null,
      transactionId: callback.gatewayTxnId ?? null,
      paidAt: at,
      lastError: null,
    })
    .where(eq(cardPayments.orderId, orderId));
}

/** Khách trả trễ (đơn đã tự huỷ vì quá hạn): còn đủ hàng thì giữ lại đơn cho khách. */
async function tryRestoreLateOrder(tx: Tx, order: OrderRow, at: Date): Promise<string[] | true> {
  const lines = await tx
    .select({ itemId: orderItems.itemId })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), isNotNull(orderItems.itemId)));
  const ids = lines.map((line) => line.itemId!);
  const locked =
    ids.length > 0
      ? await tx
          .select()
          .from(items)
          .where(inArray(items.id, ids))
          .orderBy(asc(items.id))
          .for('update')
      : [];
  const taken = locked.filter((item) => item.status !== 'available').map((item) => item.code);
  if (taken.length > 0 || locked.length !== ids.length)
    return taken.length > 0 ? taken : ['một con'];
  await sellItems(tx, order.id, ids, at);
  // Trả lại lượt mã giảm giá đã nhả lúc huỷ (khách đã trả đúng số tiền sau giảm).
  const [redemption] = await tx
    .select()
    .from(couponRedemptions)
    .where(eq(couponRedemptions.orderId, order.id))
    .for('update');
  if (redemption?.releasedAt) {
    await tx
      .update(couponRedemptions)
      .set({ releasedAt: null })
      .where(eq(couponRedemptions.id, redemption.id));
    await tx
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1` })
      .where(eq(coupons.code, redemption.couponCode));
  }
  return true;
}

/**
 * Xử lý kết quả cổng báo về (từ đường IPN, hoặc cổng giả lập gọi thẳng). Mỗi kết quả chỉ xử lý
 * một lần (payment_events.event_key duy nhất); khoá lượt thanh toán và đơn trong transaction.
 */
export async function handleGatewayCallback(
  deps: PaymentDeps,
  params: Record<string, string>,
): Promise<CallbackOutcome> {
  const gateway = requireGateway(deps);
  const verified = gateway.verifyCallback(params);
  if (!verified.valid || !verified.callback) {
    deps.logger.warn({ gateway: gateway.name }, 'Cổng thanh toán gọi về với chữ ký sai');
    await deps.db.insert(paymentEvents).values({
      id: newId(),
      gateway: gateway.name,
      eventKey: `${gateway.name}:bad-signature:${newId()}`,
      payload: sanitize(params),
      signatureOk: false,
      result: 'bad-signature',
    });
    return 'bad-signature';
  }
  const callback = verified.callback;
  const eventKey = [
    gateway.name,
    callback.attemptId,
    callback.gatewayTxnId ?? '-',
    callback.success ? 'success' : 'failed',
    callback.code,
  ]
    .join(':')
    .slice(0, 191);

  let itemsChanged = false;
  let outcome: CallbackOutcome;
  try {
    outcome = await withTransaction(deps.db, async (tx) => {
      const record = async (result: CallbackOutcome, attemptId: string | null) => {
        await tx.insert(paymentEvents).values({
          id: newId(),
          gateway: gateway.name,
          eventKey,
          attemptId,
          payload: sanitize(params),
          signatureOk: true,
          result,
        });
        return result;
      };
      const [seen] = await tx
        .select({ id: paymentEvents.id })
        .from(paymentEvents)
        .where(eq(paymentEvents.eventKey, eventKey))
        .limit(1);
      if (seen) return 'already-processed' as const;

      const [attempt] = await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.id, callback.attemptId))
        .for('update');
      if (!attempt) return record('unknown-attempt', null);
      const order = (await lockOrder(tx, attempt.orderId))!;
      const at = new Date();
      const money = formatCurrency(callback.amount);
      const card = cardLabel(callback.brand, callback.last4);
      const txn = callback.gatewayTxnId ?? 'không rõ';

      if (attempt.status === 'succeeded' || attempt.status === 'failed') {
        return record('already-processed', attempt.id);
      }
      if (callback.amount !== attempt.amount) {
        await tx
          .update(paymentAttempts)
          .set({
            responseCode: callback.code,
            message: `Số tiền cổng báo (${money}) khác số tiền cần trả (${formatCurrency(attempt.amount)}).`,
            finishedAt: at,
          })
          .where(eq(paymentAttempts.id, attempt.id));
        if (callback.success) {
          await openMoneyIssue(
            tx,
            order,
            attempt.id,
            `Cổng báo đã trừ ${money} từ ${card} (mã giao dịch ${txn}) nhưng số tiền cần trả là ${formatCurrency(attempt.amount)}. Đơn chưa được ghi là đã thanh toán. Shop kiểm tra với cổng thanh toán rồi liên hệ khách.`,
          );
          await addEvent(
            tx,
            order.id,
            order.status,
            SYSTEM_ACTOR,
            `Cổng báo trừ ${money} (mã giao dịch ${txn}) khác số tiền của đơn — đã mở sự cố, chờ shop kiểm tra.`,
            at,
          );
        }
        return record('amount-mismatch', attempt.id);
      }

      const wasOpen = attempt.status === 'open';
      if (!callback.success) {
        await tx
          .update(paymentAttempts)
          .set({
            status: 'failed',
            responseCode: callback.code,
            message: callback.message,
            finishedAt: at,
          })
          .where(eq(paymentAttempts.id, attempt.id));
        if (wasOpen) {
          await tx
            .update(cardPayments)
            .set({ attempts: sql`${cardPayments.attempts} + 1`, lastError: callback.message })
            .where(eq(cardPayments.orderId, order.id));
        }
        return record('failed', attempt.id);
      }

      await tx
        .update(paymentAttempts)
        .set({
          status: 'succeeded',
          gatewayTxnId: callback.gatewayTxnId ?? null,
          brand: callback.brand ?? null,
          last4: callback.last4 ?? null,
          responseCode: callback.code,
          message: callback.message,
          finishedAt: at,
        })
        .where(eq(paymentAttempts.id, attempt.id));

      // 1. Bình thường: đơn thẻ còn chờ trả (kể cả tiền về từ một lượt cũ: đúng số tiền của đơn).
      if (
        order.paymentMethod === 'card' &&
        order.paymentStatus === 'unpaid' &&
        order.status === 'pending'
      ) {
        await tx.update(orders).set({ paymentStatus: 'paid' }).where(eq(orders.id, order.id));
        await markCardPaid(tx, order.id, callback, at);
        // Vẫn "Chờ xác nhận": shop kiểm hàng, gọi khách rồi mới đóng gói.
        await addEvent(
          tx,
          order.id,
          order.status,
          GATEWAY_ACTOR,
          `Đã thanh toán ${money} bằng ${card} — mã giao dịch ${txn}.`,
          at,
        );
        return record('paid', attempt.id);
      }

      // 2. Trả trễ: đơn đã tự huỷ vì quá hạn giữ hàng (lúc huỷ, lượt đang mở bị đóng theo).
      if (
        order.paymentMethod === 'card' &&
        order.status === 'cancelled' &&
        order.cancelReason === 'payment-timeout' &&
        order.paymentStatus === 'unpaid'
      ) {
        await tx.update(orders).set({ paymentStatus: 'paid' }).where(eq(orders.id, order.id));
        await markCardPaid(tx, order.id, callback, at);
        const restored = await tryRestoreLateOrder(tx, order, at);
        if (restored === true) {
          itemsChanged = true;
          await tx
            .update(orders)
            .set({ cancelReason: null, cancelNote: null })
            .where(eq(orders.id, order.id));
          await recordStatus(
            tx,
            order.id,
            'pending',
            GATEWAY_ACTOR,
            `Khách trả ${money} bằng ${card} (mã giao dịch ${txn}) sau khi đơn đã tự huỷ vì quá hạn — các con vẫn còn nên đơn được giữ lại cho khách.`,
            at,
          );
          return record('late-paid-kept', attempt.id);
        }
        const codes = restored.join(', ');
        await openMoneyIssue(
          tx,
          order,
          attempt.id,
          `Khách trả ${money} bằng ${card} (mã giao dịch ${txn}) sau khi đơn đã tự huỷ vì quá hạn, nhưng ${codes} đã bán cho người khác. Shop liên hệ khách: hoàn tiền, đổi con khác hoặc giữ tiền cho đơn sau.`,
        );
        await addEvent(
          tx,
          order.id,
          order.status,
          SYSTEM_ACTOR,
          `Nhận ${money} từ ${card} (mã giao dịch ${txn}) sau khi đơn đã tự huỷ, nhưng ${codes} đã bán cho người khác — chờ shop liên hệ khách. Hệ thống không tự hoàn tiền.`,
          at,
        );
        return record('money-issue', attempt.id);
      }

      // 3. Tiền về cho lượt đã đóng / đơn đã trả / đơn đã huỷ vì lý do khác.
      const reason =
        order.paymentStatus !== 'unpaid'
          ? `trong khi đơn đã thanh toán trước đó (trả trùng)`
          : order.status === 'cancelled'
            ? `sau khi đơn đã huỷ`
            : `cho một lượt trả thẻ đã đóng (khách đã đổi cách trả hoặc mở lượt khác)`;
      if (order.paymentStatus === 'unpaid') {
        // Ghi nhận đã trả để shipper không thu tiền lần nữa.
        await tx.update(orders).set({ paymentStatus: 'paid' }).where(eq(orders.id, order.id));
        await markCardPaid(tx, order.id, callback, at);
      }
      await openMoneyIssue(
        tx,
        order,
        attempt.id,
        `Cổng báo đã trừ ${money} từ ${card} (mã giao dịch ${txn}) ${reason}. Shop kiểm tra và liên hệ khách để thống nhất cách xử lý (hoàn lại, giữ cho đơn sau…).`,
      );
      await addEvent(
        tx,
        order.id,
        order.status,
        SYSTEM_ACTOR,
        `Nhận ${money} từ ${card} (mã giao dịch ${txn}) ${reason} — đã mở sự cố, chờ shop xử lý. Hệ thống không tự hoàn tiền.`,
        at,
      );
      return record('money-issue', attempt.id);
    });
  } catch (error) {
    // Cổng gửi lặp cùng lúc: lần kia đã ghi sự kiện này.
    if (duplicateKeyName(error) === 'payment_events_event_key_uq') return 'already-processed';
    throw error;
  }
  if (itemsChanged) deps.catalog.invalidate();
  if (outcome === 'money-issue' || outcome === 'amount-mismatch') {
    deps.logger.warn({ attemptId: callback.attemptId, outcome }, 'Có sự cố tiền cần shop xử lý');
  }
  return outcome;
}

/* ---------------- Hoàn tiền (chỉ khi admin bấm) ---------------- */

/**
 * Hoàn tiền về thẻ cho đơn đã trả bằng thẻ và đã huỷ / hoàn hàng. Mỗi lượt thanh toán chỉ một
 * lệnh hoàn đang chạy hoặc đã xong (UNIQUE), nên bấm hai lần cũng không hoàn hai lần.
 */
export async function refundCardOrder(
  deps: PaymentDeps,
  orderId: string,
  admin: Actor & { id: string },
): Promise<void> {
  const gateway = requireGateway(deps);
  const prepared = await withTransaction(deps.db, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw notFound('Không tìm thấy đơn hàng này.');
    if (order.paymentStatus !== 'paid') {
      throw conflict('Đơn này chưa thanh toán nên không có gì để hoàn.');
    }
    if (order.status !== 'cancelled' && order.status !== 'returned') {
      throw conflict('Chỉ hoàn tiền cho đơn đã huỷ hoặc đã hoàn hàng.');
    }
    const [attempt] = await tx
      .select()
      .from(paymentAttempts)
      .where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.status, 'succeeded')))
      .orderBy(desc(paymentAttempts.finishedAt))
      .limit(1);
    if (!attempt?.gatewayTxnId) {
      throw conflict('Không tìm thấy giao dịch thẻ đã trả của đơn này.');
    }
    const refundId = newId();
    try {
      await tx.insert(refunds).values({
        id: refundId,
        orderId: order.id,
        attemptId: attempt.id,
        amount: attempt.amount,
        status: 'pending',
        requestedBy: admin.id,
      });
    } catch (error) {
      if (duplicateKeyName(error) === 'refunds_one_active_uq') {
        throw conflict('Đơn này đã có lệnh hoàn tiền đang chạy hoặc đã hoàn xong.');
      }
      throw error;
    }
    return { refundId, attempt, order };
  });

  // Gọi cổng NGOÀI transaction (không giữ khoá trong lúc chờ mạng).
  const result = await gateway.refund({
    attemptId: prepared.attempt.id,
    gatewayTxnId: prepared.attempt.gatewayTxnId!,
    amount: prepared.attempt.amount,
  });
  await withTransaction(deps.db, async (tx) => {
    const at = new Date();
    if (!result.ok) {
      await tx
        .update(refunds)
        .set({ status: 'failed', error: result.message.slice(0, 255) })
        .where(eq(refunds.id, prepared.refundId));
      return;
    }
    await tx
      .update(refunds)
      .set({ status: 'succeeded', gatewayRefundId: result.refundId })
      .where(eq(refunds.id, prepared.refundId));
    await tx.update(orders).set({ paymentStatus: 'refunded' }).where(eq(orders.id, orderId));
    await tx.update(cardPayments).set({ refundedAt: at }).where(eq(cardPayments.orderId, orderId));
    const card = cardLabel(
      prepared.attempt.brand ?? undefined,
      prepared.attempt.last4 ?? undefined,
    );
    await addEvent(
      tx,
      orderId,
      prepared.order.status,
      admin,
      `Đã hoàn ${formatCurrency(prepared.attempt.amount)} qua cổng thanh toán về ${card}.`,
      at,
    );
  });
  if (!result.ok) throw conflict(`Cổng thanh toán chưa hoàn được tiền: ${result.message}`);
}

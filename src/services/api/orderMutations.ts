import type { CancelReason, OrderEvent, OrderStatus } from '@/types';
import { CARD_HOLD_MINUTES } from '@/constants/shipping';
import { createId, readDb, updateDb, type MockDatabase, type StoredOrder } from '@/mocks/db';

/* ============================================================
   Thay đổi đơn hàng dùng chung cho mọi nơi ghi dữ liệu (khách đặt,
   admin, trợ lý chat…), để trạng thái SOLD của từng con Bakugan và
   lịch sử đơn luôn được cập nhật cùng một cách.
   Chỉ dùng bên trong tầng "server" mock — người gọi tự kiểm tra quyền.
   ============================================================ */

function isAuctionLine(itemId: string): boolean {
  return itemId.startsWith('auction:');
}

/** Những con trong đơn chuyển sang SOLD, gắn với đơn này. */
export function sellOrderItems(db: MockDatabase, order: StoredOrder, at: string): void {
  order.items.forEach((line) => {
    if (isAuctionLine(line.itemId)) return;
    const item = db.items.find((entry) => entry.id === line.itemId);
    if (!item) return;
    const feed = item.feedId ? db.feeds.find((entry) => entry.id === item.feedId) : undefined;
    item.status = 'sold';
    item.soldVia = 'order';
    item.orderId = order.id;
    item.soldAt = at;
    delete item.soldNote;
    delete item.buyerName;
    if (feed) {
      item.feedTitle = feed.title;
      item.feedNumber = feed.number;
    }
  });
}

/**
 * Trả những con thuộc đơn về trạng thái còn bán (đơn huỷ, hoặc hàng hoàn trả
 * còn bán lại được). Con đã bị đơn khác hay admin xử lý thì không đụng tới.
 */
export function releaseOrderItems(db: MockDatabase, order: StoredOrder): void {
  order.items.forEach((line) => {
    const item = db.items.find((entry) => entry.id === line.itemId);
    if (!item || item.orderId !== order.id) return;
    item.status = 'available';
    delete item.soldAt;
    delete item.soldVia;
    delete item.orderId;
  });
}

/** Ghi trạng thái mới kèm một mốc trong lịch sử đơn. */
export function recordStatus(
  order: StoredOrder,
  status: OrderStatus,
  actor: string,
  at: string,
  note?: string,
): void {
  const event: OrderEvent = { id: createId('ev'), status, at, actor, note };
  order.status = status;
  order.updatedAt = at;
  order.timeline = [...order.timeline, event];
}

/**
 * Việc phải làm khi huỷ một đơn chưa rời shop: những con trong đơn được bán
 * lại, ghi lý do, và nếu là đơn đấu giá thì đánh dấu phiên bị bỏ cọc.
 */
export function releaseCancelledOrder(
  db: MockDatabase,
  order: StoredOrder,
  reason: CancelReason,
  note: string | undefined,
  at: string,
): void {
  releaseOrderItems(db, order);
  order.cancelReason = reason;
  order.cancelNote = note;
  if (order.auctionId) {
    const fulfillment = db.auctionFulfillments.find((item) => item.auctionId === order.auctionId);
    if (fulfillment) {
      fulfillment.status = 'forfeited';
      fulfillment.note = 'Đơn đấu giá đã bị huỷ.';
      fulfillment.updatedAt = at;
    }
  }
}

/* ---------------- Giữ hàng chờ trả thẻ ---------------- */

/** Đơn trả bằng thẻ, còn chờ xác nhận, chưa trả và đã quá hạn giữ hàng. */
export function cardHoldExpired(
  order: Pick<StoredOrder, 'paymentMethod' | 'paymentStatus' | 'status' | 'cardPayment'>,
  now: number = Date.now(),
): boolean {
  return (
    order.paymentMethod === 'card' &&
    order.paymentStatus === 'unpaid' &&
    order.status === 'pending' &&
    Boolean(order.cardPayment) &&
    new Date(order.cardPayment!.expiresAt).getTime() <= now
  );
}

/** Huỷ các đơn quá hạn trả thẻ, trả những con Bakugan trong đó về feed. Trả về số đơn đã huỷ. */
export function expireCardHolds(db: MockDatabase, now: number = Date.now()): number {
  const at = new Date(now).toISOString();
  let expired = 0;
  db.orders.forEach((order) => {
    if (!cardHoldExpired(order, now)) return;
    releaseCancelledOrder(db, order, 'payment-timeout', 'Quá hạn thanh toán thẻ.', at);
    recordStatus(
      order,
      'cancelled',
      'Hệ thống',
      at,
      `Quá ${CARD_HOLD_MINUTES} phút chưa thanh toán thẻ — đơn tự huỷ, các con Bakugan được mở bán lại.`,
    );
    expired += 1;
  });
  return expired;
}

/**
 * Dọn đơn giữ hàng đã quá hạn. Có backend thì việc này là một tác vụ chạy định kỳ trên
 * server; ở chế độ mock, web gọi định kỳ và trước khi đặt đơn / trả tiền.
 */
export function sweepExpiredCardHolds(now: number = Date.now()): number {
  if (!readDb().orders.some((order) => cardHoldExpired(order, now))) return 0;
  return updateDb((db) => expireCardHolds(db, now));
}

import type { CancelReason, OrderEvent, OrderStatus } from '@/types';
import { createId, type MockDatabase, type StoredOrder } from '@/mocks/db';

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

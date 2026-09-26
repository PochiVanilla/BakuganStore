import type { CancelReason, OrderEvent, OrderStatus } from '@/types';
import {
  createId,
  listAllProducts,
  patchProduct,
  type MockDatabase,
  type StoredOrder,
  type StoredOrderItem,
} from '@/mocks/db';

/* ============================================================
   Thay đổi đơn hàng dùng chung cho mọi nơi ghi dữ liệu (admin, trợ lý
   chat…), để kho và lịch sử đơn luôn được cập nhật cùng một cách.
   Chỉ dùng bên trong tầng "server" mock — người gọi tự kiểm tra quyền.
   ============================================================ */

function isCatalogItem(item: StoredOrderItem): boolean {
  return !item.productId.startsWith('auction:');
}

/** direction = -1 khi bán ra (trừ kho), +1 khi hàng quay về kho. */
export function applyStock(db: MockDatabase, items: StoredOrderItem[], direction: 1 | -1): void {
  const products = listAllProducts(db);
  items.filter(isCatalogItem).forEach((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) return;
    patchProduct(db, product.id, {
      stock: Math.max(0, product.stock + direction * item.quantity),
      soldCount: Math.max(0, product.soldCount - direction * item.quantity),
    });
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
 * Việc phải làm khi huỷ một đơn chưa rời kho: trả hàng về kho, ghi lý do,
 * và nếu là đơn đấu giá thì đánh dấu phiên bị bỏ cọc.
 */
export function releaseCancelledOrder(
  db: MockDatabase,
  order: StoredOrder,
  reason: CancelReason,
  note: string | undefined,
  at: string,
): void {
  applyStock(db, order.items, 1);
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

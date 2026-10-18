import { and, asc, desc, eq, inArray, ne, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { cardPayments, orderEvents, orderIssues, orderItems, orders } from '../../db/schema';
import type { Tx } from '../../db/tx';
import type { CardPayment, Order, OrderEvent, OrderItem } from '../../shared/types';

/*
 * Đọc đơn hàng từ CSDL và đổi thành dữ liệu web dùng (kiểu Order của web).
 * - Bản cho khách: không có ghi chú nội bộ; lịch sử ghi "TD Bakugan" thay cho tên nhân viên;
 *   có cờ `needsShopContact` khi đơn có sự cố tiền đang chờ shop xử lý.
 * - Bản cho admin: đủ tên người thao tác và ghi chú nội bộ.
 */

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type OrderEventRow = typeof orderEvents.$inferSelect;
export type CardPaymentRow = typeof cardPayments.$inferSelect;

export type Audience = 'customer' | 'admin';

export interface OrderView extends Order {
  /** Chỉ bản admin: ghi chú nội bộ, khách không thấy */
  internalNote?: string;
  /** Chỉ bản khách: shop đã nhận tiền nhưng đơn cần kiểm tra lại — nhắn shop */
  needsShopContact?: boolean;
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    itemId: row.itemId ?? (row.auctionId ? `auction:${row.auctionId}` : row.id),
    code: row.code ?? undefined,
    name: row.name,
    image: row.image,
    price: row.price,
  };
}

function toEvent(row: OrderEventRow, audience: Audience): OrderEvent {
  return {
    id: row.id,
    status: row.status,
    at: row.at.toISOString(),
    actor: audience === 'customer' && row.actorType === 'admin' ? 'TD Bakugan' : row.actorName,
    note: row.note ?? undefined,
  };
}

function toCardPayment(row: CardPaymentRow): CardPayment {
  return {
    expiresAt: row.expiresAt.toISOString(),
    attempts: row.attempts,
    brand: row.brand ?? undefined,
    last4: row.last4 ?? undefined,
    transactionId: row.transactionId ?? undefined,
    paidAt: row.paidAt?.toISOString(),
    lastError: row.lastError ?? undefined,
    refundedAt: row.refundedAt?.toISOString(),
  };
}

interface OrderParts {
  items: OrderItemRow[];
  events: OrderEventRow[];
  card?: CardPaymentRow;
  openSystemIssue: boolean;
}

export function toOrderView(order: OrderRow, parts: OrderParts, audience: Audience): OrderView {
  return {
    id: order.id,
    code: order.code,
    items: parts.items.map(toOrderItem),
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    receiverName: order.receiverName,
    phone: order.phone,
    addressLine: order.addressLine,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    source: order.source,
    userId: order.userId ?? undefined,
    customerEmail: order.customerEmail ?? undefined,
    auctionId: order.auctionId ?? undefined,
    note: order.note ?? undefined,
    cancelReason: order.cancelReason ?? undefined,
    cancelNote: order.cancelNote ?? undefined,
    timeline: parts.events.map((event) => toEvent(event, audience)),
    shippingRegion: order.shippingRegion,
    intlAddress: order.intlAddress ?? undefined,
    cardPayment: parts.card ? toCardPayment(parts.card) : undefined,
    ...(audience === 'admin'
      ? { internalNote: order.internalNote ?? undefined }
      : { needsShopContact: parts.openSystemIssue || undefined }),
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(key(row));
    if (list) list.push(row);
    else grouped.set(key(row), [row]);
  }
  return grouped;
}

/** Ghép dòng đơn, lịch sử, thanh toán thẻ, sự cố tiền cho một loạt đơn (4 câu SQL). */
export async function hydrateOrders(
  executor: Db | Tx,
  rows: readonly OrderRow[],
  audience: Audience,
): Promise<OrderView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [itemRows, eventRows, cardRows, issueRows] = await Promise.all([
    executor
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids))
      .orderBy(asc(orderItems.position)),
    executor
      .select()
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, ids))
      .orderBy(asc(orderEvents.at), asc(orderEvents.id)),
    executor.select().from(cardPayments).where(inArray(cardPayments.orderId, ids)),
    executor
      .select({ orderId: orderIssues.orderId })
      .from(orderIssues)
      .where(
        and(
          inArray(orderIssues.orderId, ids),
          eq(orderIssues.reportedBy, 'system'),
          ne(orderIssues.status, 'resolved'),
        ),
      ),
  ]);
  const itemsByOrder = groupBy(itemRows, (row) => row.orderId);
  const eventsByOrder = groupBy(eventRows, (row) => row.orderId);
  const cardByOrder = new Map(cardRows.map((row) => [row.orderId, row]));
  const withIssue = new Set(issueRows.map((row) => row.orderId));
  return rows.map((row) =>
    toOrderView(
      row,
      {
        items: itemsByOrder.get(row.id) ?? [],
        events: eventsByOrder.get(row.id) ?? [],
        card: cardByOrder.get(row.id),
        openSystemIssue: withIssue.has(row.id),
      },
      audience,
    ),
  );
}

export async function loadOrders(
  executor: Db | Tx,
  audience: Audience,
  options: { where?: SQL; limit?: number; offset?: number } = {},
): Promise<OrderView[]> {
  const query = executor
    .select()
    .from(orders)
    .where(options.where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .$dynamic();
  if (options.limit !== undefined) query.limit(options.limit).offset(options.offset ?? 0);
  return hydrateOrders(executor, await query, audience);
}

export async function loadOrder(
  executor: Db | Tx,
  orderId: string,
  audience: Audience,
  ownerId?: string,
): Promise<OrderView | undefined> {
  const [order] = await loadOrders(executor, audience, {
    where: ownerId
      ? and(eq(orders.id, orderId), eq(orders.userId, ownerId))
      : eq(orders.id, orderId),
    limit: 1,
  });
  return order;
}

/** Khoá dòng đơn tới hết transaction. `ownerId`: chỉ đơn của khách này (người khác → không thấy). */
export async function lockOrder(
  tx: Tx,
  orderId: string,
  ownerId?: string,
): Promise<OrderRow | undefined> {
  const [row] = await tx
    .select()
    .from(orders)
    .where(
      ownerId ? and(eq(orders.id, orderId), eq(orders.userId, ownerId)) : eq(orders.id, orderId),
    )
    .for('update');
  return row;
}

export async function lockCardPayment(
  tx: Tx,
  orderId: string,
): Promise<CardPaymentRow | undefined> {
  const [row] = await tx
    .select()
    .from(cardPayments)
    .where(eq(cardPayments.orderId, orderId))
    .for('update');
  return row;
}

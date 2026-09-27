import type {
  ApiResponse,
  CancelReason,
  Order,
  OrderEvent,
  OrderSource,
  OrderStatus,
  ManualPaymentMethod,
  Paginated,
  PaymentStatus,
} from '@/types';
import { MANUAL_PAYMENT_METHODS, ORDER_STATUSES } from '@/types';
import { ACTIVE_ORDER_STATUSES, describeCard, ORDER_TRANSITIONS } from '@/constants/orders';
import {
  createId,
  hydrateOrder,
  readDb,
  updateDb,
  type StoredOrder,
  type StoredOrderItem,
} from '@/mocks/db';
import { listAuctionsSnapshot } from '../auctionService';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { applyPurchaseUpgrade } from '../membershipRules';
import {
  recordStatus,
  releaseCancelledOrder,
  releaseOrderItems,
  sellOrderItems,
} from '../orderMutations';
import { generateOrderCode, withinDays } from './shared';
import { normalizeSearch } from '@/utils/slugify';

/* ---------------- Danh sách ---------------- */

export type OrderStatusFilter = OrderStatus | 'all' | 'active';

export interface AdminOrderQuery {
  status?: OrderStatusFilter;
  source?: OrderSource | 'all';
  keyword?: string;
  /** Chỉ lấy đơn trong n ngày gần nhất, 0 = tất cả */
  days?: number;
  page?: number;
  pageSize?: number;
}

export interface AdminOrderList {
  page: Paginated<Order>;
  /** Số đơn theo từng trạng thái (sau khi lọc nguồn/từ khoá/thời gian) để vẽ tab */
  counts: Record<OrderStatusFilter, number>;
}

function matchesStatus(order: StoredOrder, status: OrderStatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'active') return ACTIVE_ORDER_STATUSES.includes(order.status);
  return order.status === status;
}

export async function listOrders(query: AdminOrderQuery = {}): Promise<AdminOrderList> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminOrderList>>('/admin/orders', {
      params: query,
    });
    return data.data;
  }
  requireAdmin();
  const { status = 'all', source = 'all', keyword = '', days = 0 } = query;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? 12;
  const needle = normalizeSearch(keyword);

  const db = readDb();
  const scoped = db.orders.filter((order) => {
    if (source !== 'all' && order.source !== source) return false;
    if (!withinDays(order.createdAt, days)) return false;
    if (!needle) return true;
    const haystack = normalizeSearch(
      `${order.code} ${order.receiverName} ${order.phone} ${order.customerEmail ?? ''} ${order.items
        .map((item) => `${item.name} ${item.code ?? ''}`)
        .join(' ')}`,
    );
    return haystack.includes(needle);
  });

  const counts = { all: scoped.length, active: 0 } as Record<OrderStatusFilter, number>;
  ORDER_STATUSES.forEach((value) => {
    counts[value] = 0;
  });
  scoped.forEach((order) => {
    counts[order.status] += 1;
    if (ACTIVE_ORDER_STATUSES.includes(order.status)) counts.active += 1;
  });

  const filtered = scoped
    .filter((order) => matchesStatus(order, status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = filtered.length;

  return mockDelay({
    counts,
    page: {
      items: filtered
        .slice((page - 1) * pageSize, page * pageSize)
        .map((order) => hydrateOrder(order, db)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function getOrder(orderId: string): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Order>>(`/admin/orders/${orderId}`);
    return data.data;
  }
  requireAdmin();
  const order = readDb().orders.find((item) => item.id === orderId);
  if (!order) throw new MockApiError('Không tìm thấy đơn hàng này.', 404);
  return mockDelay(hydrateOrder(order), 220);
}

/* ---------------- Đổi trạng thái ---------------- */

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  note?: string;
  cancelReason?: CancelReason;
  /** Với đơn hoàn trả: hàng còn bán được thì mở bán lại những con trong đơn */
  restock?: boolean;
}

export async function updateOrderStatus(
  orderId: string,
  input: UpdateOrderStatusInput,
): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<Order>>(
      `/admin/orders/${orderId}/status`,
      input,
    );
    return data.data;
  }
  const admin = requireAdmin();
  const current = readDb().orders.find((item) => item.id === orderId);
  if (!current) throw new MockApiError('Không tìm thấy đơn hàng này.', 404);
  if (!ORDER_TRANSITIONS[current.status].includes(input.status)) {
    throw new MockApiError('Không thể chuyển đơn sang trạng thái này từ trạng thái hiện tại.', 409);
  }
  if (input.status === 'cancelled' && !input.cancelReason) {
    throw new MockApiError('Vui lòng chọn lý do huỷ đơn.', 422, {
      cancelReason: 'Vui lòng chọn lý do huỷ đơn.',
    });
  }

  const now = new Date().toISOString();
  const updated = updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId)!;
    const note = input.note?.trim() || undefined;

    if (input.status === 'cancelled') {
      // Hàng chưa rời shop nên những con trong đơn được mở bán lại ngay.
      releaseCancelledOrder(db, order, input.cancelReason!, note, now);
    }
    if (input.status === 'returned' && input.restock) releaseOrderItems(db, order);
    if (input.status === 'completed' && order.paymentMethod === 'cod') order.paymentStatus = 'paid';

    recordStatus(order, input.status, admin.fullName, now, note);
    // Khách nhận đủ 3 Bakugan thì tự lên thành viên Lv2.
    if (input.status === 'completed' && order.userId) applyPurchaseUpgrade(db, order.userId, now);
    return order;
  });

  return mockDelay(hydrateOrder(updated), 350);
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<Order>>(`/admin/orders/${orderId}/payment`, {
      paymentStatus,
    });
    return data.data;
  }
  const admin = requireAdmin();
  const current = readDb().orders.find((item) => item.id === orderId);
  if (!current) throw new MockApiError('Không tìm thấy đơn hàng này.', 404);
  // Đơn trả thẻ: cổng thanh toán là nơi xác nhận tiền, admin không tự đánh dấu đã trả.
  if (current.paymentMethod === 'card' && paymentStatus !== 'refunded') {
    throw new MockApiError(
      'Đơn trả bằng thẻ được cổng thanh toán tự xác nhận — không đánh dấu tay được.',
      409,
    );
  }
  if (paymentStatus === 'refunded' && current.paymentStatus !== 'paid') {
    throw new MockApiError('Đơn này chưa thanh toán nên không có gì để hoàn.', 409);
  }
  const updated = updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId)!;
    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    // Có backend: bước này gọi API hoàn tiền của cổng thanh toán, tiền về đúng thẻ khách đã trả.
    if (paymentStatus === 'refunded' && order.cardPayment) {
      order.cardPayment = { ...order.cardPayment, refundedAt: order.updatedAt };
    }
    order.timeline = [
      ...order.timeline,
      {
        id: createId('ev'),
        status: order.status,
        at: order.updatedAt,
        actor: admin.fullName,
        note:
          paymentStatus === 'paid'
            ? 'Xác nhận đã nhận tiền.'
            : paymentStatus === 'refunded'
              ? order.paymentMethod === 'card'
                ? `Đã hoàn ${order.total.toLocaleString('vi-VN')}₫ qua cổng thanh toán về ${describeCard(order.cardPayment)}.`
                : 'Đã hoàn tiền cho khách.'
              : 'Đánh dấu chưa thanh toán.',
      },
    ];
    return order;
  });
  return mockDelay(hydrateOrder(updated), 300);
}

export async function updateOrderNote(orderId: string, note: string): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<Order>>(`/admin/orders/${orderId}`, {
      note,
    });
    return data.data;
  }
  requireAdmin();
  const updated = updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) throw new MockApiError('Không tìm thấy đơn hàng này.', 404);
    order.note = note.trim() || undefined;
    return order;
  });
  return mockDelay(hydrateOrder(updated), 250);
}

/* ---------------- Tạo đơn ---------------- */

export interface AdminCreateOrderInput {
  /** Bỏ trống khi tạo cho khách lẻ không có tài khoản */
  customerId?: string;
  customerEmail?: string;
  receiverName: string;
  phone: string;
  addressLine: string;
  /** Những con Bakugan còn bán. Giá có thể khác giá trên feed (admin chốt giá riêng). */
  items: Array<{ itemId: string; price: number }>;
  /** Tạo đơn cho người thắng phiên — giá lấy theo giá chốt của phiên */
  auctionId?: string;
  shippingFee: number;
  discount: number;
  /** Thẻ chỉ trả được qua cổng thanh toán khi khách tự đặt trên web */
  paymentMethod: ManualPaymentMethod;
  paymentStatus: 'unpaid' | 'paid';
  initialStatus: 'pending' | 'confirmed';
  note?: string;
}

export async function createOrder(input: AdminCreateOrderInput): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Order>>('/admin/orders', input);
    return data.data;
  }
  const admin = requireAdmin();
  if (!MANUAL_PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new MockApiError('Đơn tạo tay chỉ chọn COD, chuyển khoản hoặc MoMo.', 422);
  }
  const db = readDb();

  // Server tự tra tên và trạng thái từng con, không tin dữ liệu gửi lên.
  const seen = new Set<string>();
  const items: StoredOrderItem[] = input.items.map((line) => {
    const item = db.items.find((entry) => entry.id === line.itemId);
    if (!item) throw new MockApiError('Có con Bakugan không còn tồn tại.', 422);
    if (seen.has(item.id)) throw new MockApiError(`${item.code} bị chọn hai lần.`, 422);
    seen.add(item.id);
    if (item.status !== 'available') {
      throw new MockApiError(`${item.code} ${item.name} đã bán rồi.`, 409);
    }
    if (!Number.isInteger(line.price) || line.price < 0) {
      throw new MockApiError('Đơn giá không hợp lệ.', 422);
    }
    return { itemId: item.id, code: item.code, name: item.name, price: line.price };
  });

  if (input.auctionId) {
    const auction = listAuctionsSnapshot().find((item) => item.id === input.auctionId);
    if (!auction) throw new MockApiError('Không tìm thấy phiên đấu giá.', 404);
    if (auction.status !== 'ended' || auction.bids.length === 0) {
      throw new MockApiError('Phiên chưa kết thúc hoặc không có người thắng.', 409);
    }
    const existing = db.auctionFulfillments.find(
      (item) => item.auctionId === auction.id && item.status === 'order-created',
    );
    if (existing) throw new MockApiError('Phiên này đã được tạo đơn rồi.', 409);
    items.unshift({
      itemId: `auction:${auction.id}`,
      name: auction.title,
      price: auction.currentPrice,
    });
  }

  if (items.length === 0) throw new MockApiError('Đơn hàng cần ít nhất một con Bakugan.', 422);
  if (input.shippingFee < 0 || input.discount < 0) {
    throw new MockApiError('Phí ship và giảm giá không được âm.', 422);
  }

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const now = new Date();
  const nowIso = now.toISOString();
  const orderId = createId('ord');
  const source: OrderSource = input.auctionId ? 'auction' : 'manual';

  const timeline: OrderEvent[] = [
    {
      id: createId('ev'),
      status: 'pending',
      at: nowIso,
      actor: admin.fullName,
      note: source === 'auction' ? 'Tạo đơn cho người thắng đấu giá.' : 'Admin tạo đơn thủ công.',
    },
  ];
  if (input.initialStatus === 'confirmed') {
    timeline.push({
      id: createId('ev'),
      status: 'confirmed',
      at: nowIso,
      actor: admin.fullName,
      note: 'Đã xác nhận với khách khi tạo đơn.',
    });
  }

  const created = updateDb((draft) => {
    const order: StoredOrder = {
      id: orderId,
      code: generateOrderCode(draft.orders, now),
      items,
      subtotal,
      shippingFee: input.shippingFee,
      discount: Math.min(input.discount, subtotal + input.shippingFee),
      total: Math.max(0, subtotal + input.shippingFee - input.discount),
      status: input.initialStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
      receiverName: input.receiverName.trim(),
      phone: input.phone.trim(),
      addressLine: input.addressLine.trim(),
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      source,
      userId: input.customerId,
      customerEmail: input.customerEmail?.trim() || undefined,
      auctionId: input.auctionId,
      note: input.note?.trim() || undefined,
      timeline,
    };
    draft.orders.unshift(order);
    sellOrderItems(draft, order, nowIso);
    if (input.auctionId) {
      draft.auctionFulfillments = draft.auctionFulfillments.filter(
        (item) => item.auctionId !== input.auctionId,
      );
      draft.auctionFulfillments.push({
        auctionId: input.auctionId,
        status: 'order-created',
        orderId,
        updatedAt: nowIso,
      });
    }
    return order;
  });

  return mockDelay(hydrateOrder(created), 500);
}

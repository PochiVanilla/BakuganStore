import type {
  ApiResponse,
  CancelReason,
  Order,
  OrderEvent,
  OrderSource,
  OrderStatus,
  Paginated,
  PaymentMethod,
  PaymentStatus,
} from '@/types';
import { ORDER_STATUSES } from '@/types';
import { ACTIVE_ORDER_STATUSES, ORDER_TRANSITIONS } from '@/constants/orders';
import {
  createId,
  hydrateOrder,
  listAllProducts,
  readDb,
  updateDb,
  type StoredOrder,
  type StoredOrderItem,
} from '@/mocks/db';
import { listAuctionsSnapshot } from '../auctionService';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { applyStock, recordStatus, releaseCancelledOrder } from '../orderMutations';
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

  const scoped = readDb().orders.filter((order) => {
    if (source !== 'all' && order.source !== source) return false;
    if (!withinDays(order.createdAt, days)) return false;
    if (!needle) return true;
    const haystack = normalizeSearch(
      `${order.code} ${order.receiverName} ${order.phone} ${order.customerEmail ?? ''} ${order.items
        .map((item) => item.name)
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
  const products = listAllProducts();
  const total = filtered.length;

  return mockDelay({
    counts,
    page: {
      items: filtered
        .slice((page - 1) * pageSize, page * pageSize)
        .map((order) => hydrateOrder(order, products)),
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
  /** Với đơn hoàn trả: có nhập hàng lại kho không (hàng còn bán được) */
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
      // Hàng chưa rời kho nên trả lại tồn kho ngay.
      releaseCancelledOrder(db, order, input.cancelReason!, note, now);
    }
    if (input.status === 'returned' && input.restock) applyStock(db, order.items, 1);
    if (input.status === 'completed' && order.paymentMethod === 'cod') order.paymentStatus = 'paid';

    recordStatus(order, input.status, admin.fullName, now, note);
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
  const updated = updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) throw new MockApiError('Không tìm thấy đơn hàng này.', 404);
    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
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
              ? 'Đã hoàn tiền cho khách.'
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
  /** Món trong kho. Giá có thể khác giá niêm yết (admin chốt giá riêng). */
  items: Array<{ productId: string; quantity: number; price: number }>;
  /** Tạo đơn cho người thắng phiên — giá lấy theo giá chốt của phiên */
  auctionId?: string;
  shippingFee: number;
  discount: number;
  paymentMethod: PaymentMethod;
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
  const db = readDb();
  const products = listAllProducts(db);

  // Server tự tra tên và tồn kho, không tin dữ liệu gửi lên.
  const items: StoredOrderItem[] = input.items.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) throw new MockApiError('Có sản phẩm không còn tồn tại trong kho.', 422);
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new MockApiError(`Số lượng của "${product.name}" không hợp lệ.`, 422);
    }
    if (line.quantity > product.stock) {
      throw new MockApiError(
        `"${product.name}" chỉ còn ${product.stock} trong kho, không đủ ${line.quantity}.`,
        409,
      );
    }
    if (line.price < 0) throw new MockApiError('Đơn giá không được âm.', 422);
    return {
      productId: product.id,
      name: product.name,
      price: line.price,
      quantity: line.quantity,
    };
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
      productId: `auction:${auction.id}`,
      name: auction.title,
      price: auction.currentPrice,
      quantity: 1,
    });
  }

  if (items.length === 0) throw new MockApiError('Đơn hàng cần ít nhất một sản phẩm.', 422);
  if (input.shippingFee < 0 || input.discount < 0) {
    throw new MockApiError('Phí ship và giảm giá không được âm.', 422);
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
    applyStock(draft, items, -1);
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

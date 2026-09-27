import type { ApiResponse, Coupon, Order, OrderEvent, PaymentMethod, ShopBankInfo } from '@/types';
import { MOCK_COUPONS } from '@/mocks';
import { createId, hydrateOrder, isFeedOpen, readDb, updateDb, type StoredOrder } from '@/mocks/db';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { requireUser } from './mockSession';
import { sellOrderItems } from './orderMutations';
import { generateOrderCode } from './admin/shared';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';

export interface CartTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

/** Tính tiền ở một chỗ duy nhất — backend sẽ tính lại y hệt khi đặt hàng. */
export function calculateTotals(
  items: ReadonlyArray<{ price: number }>,
  coupon: Coupon | null,
): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  let shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
  let discount = 0;

  if (coupon && subtotal >= coupon.minSubtotal) {
    if (coupon.type === 'percent') {
      discount = Math.floor((subtotal * coupon.value) / 100);
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === 'amount') {
      discount = Math.min(coupon.value, subtotal);
    } else {
      shippingFee = 0;
    }
  }

  return { subtotal, shippingFee, discount, total: Math.max(0, subtotal + shippingFee - discount) };
}

function findCoupon(code: string, subtotal: number): Coupon {
  const coupon = MOCK_COUPONS.find((item) => item.code.toLowerCase() === code.trim().toLowerCase());
  if (!coupon) throw new MockApiError('Mã giảm giá không tồn tại hoặc đã hết hạn.', 404);
  if (new Date(coupon.expiresAt).getTime() < Date.now()) {
    throw new MockApiError('Mã giảm giá đã hết hạn.', 410);
  }
  if (subtotal < coupon.minSubtotal) {
    throw new MockApiError(
      `Mã này áp dụng cho đơn từ ${coupon.minSubtotal.toLocaleString('vi-VN')}₫.`,
      422,
    );
  }
  return coupon;
}

export async function applyCoupon(code: string, subtotal: number): Promise<Coupon> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Coupon>>('/coupons/apply', {
      code,
      subtotal,
    });
    return data.data;
  }
  return mockDelay(findCoupon(code, subtotal), 500);
}

export async function fetchAvailableCoupons(): Promise<Coupon[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Coupon[]>>('/coupons');
    return data.data;
  }
  return mockDelay(MOCK_COUPONS, 200);
}

/** Tài khoản nhận chuyển khoản của shop — null nếu admin chưa nhập. */
export async function fetchShopBank(): Promise<ShopBankInfo | null> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ShopBankInfo | null>>('/shop/bank');
    return data.data;
  }
  const bank = readDb().shopSettings.bank;
  return mockDelay(bank.accountNumber.trim() ? { ...bank } : null, 120);
}

/* ---------------- Đặt hàng ---------------- */

export interface CheckoutInput {
  /** Những con Bakugan trong giỏ — mỗi con là duy nhất */
  itemIds: string[];
  receiverName: string;
  phone: string;
  addressLine: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  note?: string;
}

/**
 * Khách chốt đơn. Server kiểm tra lại từng con: còn trên feed, feed đã tới giờ
 * mở bán và chưa ai mua. Con nào vừa bị người khác chốt trước thì báo lại.
 */
export async function placeOrder(input: CheckoutInput): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Order>>('/orders', input);
    return data.data;
  }
  const user = requireUser();
  if (user.role !== 'customer') {
    throw new MockApiError('Tài khoản quản trị không đặt hàng được — dùng trang Tạo đơn.', 403);
  }
  const ids = [...new Set(input.itemIds)];
  if (ids.length === 0) throw new MockApiError('Giỏ hàng đang trống.', 422);
  if (!input.receiverName.trim() || !input.phone.trim() || !input.addressLine.trim()) {
    throw new MockApiError('Vui lòng nhập đủ người nhận, số điện thoại và địa chỉ.', 422);
  }

  const db = readDb();
  const now = new Date();
  const nowMs = now.getTime();
  const lines = ids.map((id) => {
    const item = db.items.find((entry) => entry.id === id);
    const feed = item?.feedId ? db.feeds.find((entry) => entry.id === item.feedId) : undefined;
    return { id, item, feed };
  });
  const gone = lines.filter(({ item, feed }) => !item || !feed || item.status !== 'available');
  if (gone.length > 0) {
    const codes = gone.map(({ item }) => item?.code ?? 'một con').join(', ');
    throw new MockApiError(
      `${codes} vừa có người chốt trước hoặc không còn trên feed. Bạn bỏ khỏi giỏ rồi đặt lại nhé.`,
      409,
    );
  }
  const notOpen = lines.filter(({ feed }) => feed && !isFeedOpen(feed, nowMs));
  if (notOpen.length > 0) {
    throw new MockApiError(
      `Feed #${notOpen[0]!.feed!.number} chưa tới giờ mở bán, bạn quay lại đúng giờ để chốt nhé.`,
      409,
    );
  }

  const priced = lines.map(({ item }) => ({ price: item!.price }));
  const subtotal = priced.reduce((sum, item) => sum + item.price, 0);
  const coupon = input.couponCode ? findCoupon(input.couponCode, subtotal) : null;
  const totals = calculateTotals(priced, coupon);
  const nowIso = now.toISOString();

  const created = updateDb((draft) => {
    const timeline: OrderEvent[] = [
      {
        id: createId('ev'),
        status: 'pending',
        at: nowIso,
        actor: 'Khách hàng',
        note: coupon ? `Khách đặt trên web, dùng mã ${coupon.code}.` : 'Khách đặt trên web.',
      },
    ];
    const order: StoredOrder = {
      id: createId('ord'),
      code: generateOrderCode(draft.orders, now),
      items: lines.map(({ item }) => ({
        itemId: item!.id,
        code: item!.code,
        name: item!.name,
        price: item!.price,
      })),
      ...totals,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
      receiverName: input.receiverName.trim(),
      phone: input.phone.trim(),
      addressLine: input.addressLine.trim(),
      paymentMethod: input.paymentMethod,
      paymentStatus: 'unpaid',
      source: 'web',
      userId: user.id,
      customerEmail: user.email,
      note: input.note?.trim().slice(0, 500) || undefined,
      timeline,
    };
    draft.orders.unshift(order);
    sellOrderItems(draft, order, nowIso);
    return order;
  });

  return mockDelay(hydrateOrder(created), 600);
}

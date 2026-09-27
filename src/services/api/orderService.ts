import type {
  ApiResponse,
  CheckoutConfig,
  Coupon,
  InternationalAddress,
  Order,
  OrderEvent,
  PaymentMethod,
  ShippingRegion,
  ShopBankInfo,
} from '@/types';
import { MOCK_COUPONS } from '@/mocks';
import { createId, hydrateOrder, isFeedOpen, readDb, updateDb, type StoredOrder } from '@/mocks/db';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { requireUser } from './mockSession';
import { sellOrderItems, sweepExpiredCardHolds } from './orderMutations';
import { generateOrderCode } from './admin/shared';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';
import { CARD_HOLD_MINUTES, DEFAULT_INTERNATIONAL_SHIPPING } from '@/constants/shipping';
import { zoneOf } from '@/constants/countries';
import { cleanIntlAddress, formatIntlAddress, validateIntlAddress } from '@/utils/intlAddress';
import { compactPhone, isValidPhone, isVietnamPhone } from '@/utils/phone';

export interface CartTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

/** Giao tới đâu — quyết định phí vận chuyển và cách thanh toán được phép. */
export interface ShippingDestination {
  region: ShippingRegion;
  /** Mã nước khi gửi ra nước ngoài */
  countryCode?: string;
}

export const DOMESTIC: ShippingDestination = { region: 'domestic' };

/** Dùng khi chưa tải được cấu hình (VD phần tóm tắt trong giỏ hàng). */
export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  domesticFee: SHIPPING_FEE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  cardPayments: true,
  international: DEFAULT_INTERNATIONAL_SHIPPING,
  cardHoldMinutes: CARD_HOLD_MINUTES,
};

export function shippingFeeFor(
  destination: ShippingDestination,
  subtotal: number,
  config: CheckoutConfig = DEFAULT_CHECKOUT_CONFIG,
): number {
  if (subtotal === 0) return 0;
  if (destination.region === 'international') {
    return zoneOf(destination.countryCode ?? '') === 'asia'
      ? config.international.feeAsia
      : config.international.feeWorld;
  }
  return subtotal >= config.freeShippingThreshold ? 0 : config.domesticFee;
}

/** Mã miễn phí vận chuyển chỉ dùng cho đơn trong nước (phí gửi quốc tế cao hơn nhiều). */
export function couponAppliesTo(coupon: Coupon, destination: ShippingDestination): boolean {
  return coupon.type !== 'shipping' || destination.region === 'domestic';
}

/** Tính tiền ở một chỗ duy nhất — backend sẽ tính lại y hệt khi đặt hàng. */
export function calculateTotals(
  items: ReadonlyArray<{ price: number }>,
  coupon: Coupon | null,
  destination: ShippingDestination = DOMESTIC,
  config: CheckoutConfig = DEFAULT_CHECKOUT_CONFIG,
): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  let shippingFee = shippingFeeFor(destination, subtotal, config);
  let discount = 0;

  if (coupon && subtotal >= coupon.minSubtotal && couponAppliesTo(coupon, destination)) {
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

/** Phí ship, giao quốc tế và thẻ có đang bật không — cho trang thanh toán. */
export async function fetchCheckoutConfig(): Promise<CheckoutConfig> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<CheckoutConfig>>('/checkout/config');
    return data.data;
  }
  const { shopSettings } = readDb();
  return mockDelay(
    {
      ...DEFAULT_CHECKOUT_CONFIG,
      cardPayments: shopSettings.cardPayments,
      international: { ...shopSettings.international },
    },
    80,
  );
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
  /** Địa chỉ một dòng khi giao trong nước (gửi ra nước ngoài thì dùng intlAddress) */
  addressLine: string;
  /** Mặc định giao trong nước */
  shippingRegion?: ShippingRegion;
  intlAddress?: InternationalAddress;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  note?: string;
}

function invalid(message: string): never {
  throw new MockApiError(message, 422);
}

/**
 * Khách chốt đơn. Server kiểm tra lại từng con: còn trên feed, feed đã tới giờ
 * mở bán và chưa ai mua. Con nào vừa bị người khác chốt trước thì báo lại.
 * Đơn trả bằng thẻ được giữ hàng {@link CARD_HOLD_MINUTES} phút chờ khách thanh toán.
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
  if (ids.length === 0) invalid('Giỏ hàng đang trống.');

  // Đơn trả thẻ quá hạn thì huỷ trước, để những con đang bị giữ được bán lại.
  sweepExpiredCardHolds();
  const { shopSettings } = readDb();
  const region: ShippingRegion = input.shippingRegion ?? 'domestic';
  const receiverName = input.receiverName.trim();
  const phone = input.phone.trim();
  if (receiverName.length < 2) invalid('Nhập họ tên người nhận.');
  if (input.paymentMethod === 'card' && !shopSettings.cardPayments) {
    invalid('Shop đang tạm ngưng nhận thanh toán thẻ — bạn chọn cách khác nhé.');
  }

  let addressLine: string;
  let intlAddress: InternationalAddress | undefined;
  if (region === 'international') {
    if (!shopSettings.international.enabled) {
      invalid('Shop đang tạm ngưng gửi hàng ra nước ngoài.');
    }
    if (input.paymentMethod !== 'card') {
      invalid('Đơn gửi ra nước ngoài chỉ thanh toán bằng thẻ Visa / Mastercard / JCB.');
    }
    if (!compactPhone(phone).startsWith('+') || !isValidPhone(phone)) {
      invalid('Ghi số điện thoại kèm mã nước (VD +1 415 555 0123) để bưu điện nước ngoài liên hệ.');
    }
    const problems = validateIntlAddress(
      input.intlAddress ?? { countryCode: '', line1: '', city: '' },
    );
    const firstProblem = Object.values(problems)[0];
    if (firstProblem) invalid(firstProblem);
    intlAddress = cleanIntlAddress(input.intlAddress!);
    addressLine = formatIntlAddress(intlAddress);
  } else {
    if (!isVietnamPhone(phone)) {
      invalid('Số điện thoại người nhận chưa đúng (VD 0912345678).');
    }
    addressLine = input.addressLine.trim();
    if (addressLine.length < 10) {
      invalid('Ghi rõ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.');
    }
  }
  const destination: ShippingDestination = { region, countryCode: intlAddress?.countryCode };

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
  if (coupon && !couponAppliesTo(coupon, destination)) {
    invalid(`Mã ${coupon.code} chỉ áp dụng cho đơn giao trong Việt Nam — gỡ mã rồi đặt lại nhé.`);
  }
  const totals = calculateTotals(priced, coupon, destination, {
    ...DEFAULT_CHECKOUT_CONFIG,
    international: shopSettings.international,
  });
  const nowIso = now.toISOString();
  const byCard = input.paymentMethod === 'card';
  const placedNote = [
    region === 'international' ? 'Khách đặt trên web, gửi ra nước ngoài.' : 'Khách đặt trên web.',
    coupon && `Dùng mã ${coupon.code}.`,
    byCard && `Trả bằng thẻ — giữ hàng ${CARD_HOLD_MINUTES} phút chờ thanh toán.`,
  ]
    .filter(Boolean)
    .join(' ');

  const created = updateDb((draft) => {
    const timeline: OrderEvent[] = [
      {
        id: createId('ev'),
        status: 'pending',
        at: nowIso,
        actor: 'Khách hàng',
        note: placedNote,
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
      receiverName,
      phone,
      addressLine,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'unpaid',
      source: 'web',
      userId: user.id,
      customerEmail: user.email,
      note: input.note?.trim().slice(0, 500) || undefined,
      timeline,
      shippingRegion: region,
      intlAddress,
      cardPayment: byCard
        ? {
            expiresAt: new Date(now.getTime() + CARD_HOLD_MINUTES * 60_000).toISOString(),
            attempts: 0,
          }
        : undefined,
    };
    draft.orders.unshift(order);
    sellOrderItems(draft, order, nowIso);
    return order;
  });

  return mockDelay(hydrateOrder(created), 600);
}

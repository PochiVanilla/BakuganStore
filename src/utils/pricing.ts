import type { CheckoutConfig, Coupon, ShippingRegion } from '@/types';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';
import { CARD_HOLD_MINUTES, DEFAULT_INTERNATIONAL_SHIPPING } from '@/constants/shipping';
import { zoneOf } from '@/constants/countries';

/*
 * Tính tiền ở một chỗ duy nhất. Web và backend (backend/) cùng import file này,
 * nên hai bên không bao giờ tính lệch nhau. Không import React, DOM hay dữ liệu giả.
 */

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

/** Tính tiền ở một chỗ duy nhất — backend tính lại y hệt khi đặt hàng. */
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

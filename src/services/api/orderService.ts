import type { ApiResponse, CartItem, Coupon } from '@/types';
import { MOCK_COUPONS } from '@/mocks';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';

export interface CartTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

/** Tính tiền ở một chỗ duy nhất — backend sẽ tính lại y hệt khi checkout. */
export function calculateTotals(items: CartItem[], coupon: Coupon | null): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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

export async function applyCoupon(code: string, subtotal: number): Promise<Coupon> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Coupon>>('/coupons/apply', {
      code,
      subtotal,
    });
    return data.data;
  }

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
  return mockDelay(coupon, 500);
}

export async function fetchAvailableCoupons(): Promise<Coupon[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Coupon[]>>('/coupons');
    return data.data;
  }
  return mockDelay(MOCK_COUPONS, 200);
}

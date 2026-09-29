import { describe, expect, it } from 'vitest';
import { checkSharedImports } from '../../scripts/check-shared-imports';
import { attributeKeyOf, conditionGradeOf, normalizeSearch } from '../../src/shared/catalog';
import { DEFAULT_COUPONS, INITIAL_SHOP_SETTINGS } from '../../src/shared/defaults';
import { calculateTotals, DEFAULT_CHECKOUT_CONFIG } from '../../src/shared/pricing';
import { ORDER_STATUSES } from '../../src/shared/types';

describe('dùng chung code với web', () => {
  it('backend chỉ lấy code web qua src/shared và code đó "thuần"', () => {
    expect(checkSharedImports()).toEqual([]);
  });

  it('tính tiền đúng như web: ship, miễn ship, mã giảm giá', () => {
    const percent = {
      code: 'TDNEW10',
      label: '',
      type: 'percent' as const,
      value: 10,
      minSubtotal: 500_000,
      maxDiscount: 150_000,
      expiresAt: '',
    };
    expect(calculateTotals([{ price: 300_000 }], null)).toEqual({
      subtotal: 300_000,
      shippingFee: DEFAULT_CHECKOUT_CONFIG.domesticFee,
      discount: 0,
      total: 300_000 + DEFAULT_CHECKOUT_CONFIG.domesticFee,
    });
    expect(calculateTotals([{ price: 2_000_000 }], percent).discount).toBe(150_000);
    expect(calculateTotals([{ price: 900_000 }], null).shippingFee).toBe(0);
    const freeShip = { ...percent, type: 'shipping' as const, value: 0, minSubtotal: 0 };
    expect(
      calculateTotals([{ price: 100_000 }], freeShip, {
        region: 'international',
        countryCode: 'US',
      }).shippingFee,
    ).toBe(DEFAULT_CHECKOUT_CONFIG.international.feeWorld);
  });

  it('nhận ra hệ và tình trạng từ chữ shop tự gõ', () => {
    expect(attributeKeyOf('Hệ Lửa')).toBe('pyrus');
    expect(attributeKeyOf('ĐẤT')).toBe('subterra');
    expect(attributeKeyOf('Aurelus')).toBeUndefined();
    expect(conditionGradeOf('Like new, trầy nhẹ')).toBe('like-new');
    expect(normalizeSearch('Đất Đỏ')).toBe('dat do');
  });

  it('bản thật mới cài: thẻ và giao quốc tế tắt, chưa có tài khoản nhận tiền', () => {
    expect(INITIAL_SHOP_SETTINGS.cardPayments).toBe(false);
    expect(INITIAL_SHOP_SETTINGS.international.enabled).toBe(false);
    expect(INITIAL_SHOP_SETTINGS.bank.accountNumber).toBe('');
    expect(DEFAULT_COUPONS.find((coupon) => coupon.code === 'TDNEW10')?.firstOrderOnly).toBe(true);
    expect(ORDER_STATUSES).toContain('pending');
  });
});

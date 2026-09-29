import type { BotSettings, Coupon, ShopSettings } from '@/types';
import { DEFAULT_INTERNATIONAL_SHIPPING } from './shipping';

/*
 * Dữ liệu có sẵn lúc mở shop. Web giả lập và backend (backend/) cùng import file này,
 * nên CSDL thật khởi đầu đúng như bản chạy thử. Không import React, DOM hay dữ liệu giả.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Số tiền khách nạp để lên Lv2 khi admin chưa chỉnh */
export const DEFAULT_MEMBER_DEPOSIT = 500_000;

/** Cài đặt bot lúc mở shop; admin sửa trong trang Cài đặt. */
export const INITIAL_BOT_SETTINGS: Omit<BotSettings, 'updatedAt'> = {
  enabled: true,
  greeting:
    'Chào bạn! Mình là trợ lý AI của TD Bakugan. Mình tư vấn chọn Bakugan trong feed, tra đơn, huỷ đơn chưa xác nhận, giải thích cách lên Lv2 để đấu giá… Việc nào cần nhân viên, mình chuyển ngay nhé.',
  topics: {
    'order-status': true,
    'order-cancel': true,
    shipping: true,
    payment: true,
    returns: true,
    'auction-rules': true,
    'product-info': true,
    'bakugan-knowledge': true,
    membership: true,
    'store-info': true,
    promotions: true,
  },
  extraKnowledge: 'Feed mới thường mở bán lúc 20:00. Hàng hiếm không nhận giữ quá 24 giờ.',
  handoffMessage:
    'Mình đã chuyển cuộc trò chuyện cho nhân viên TD Bakugan. Bạn chờ chút nhé — giờ làm việc 09:00–21:00 hằng ngày.',
};

/**
 * Cài đặt shop của bản thật lúc mới cài. Thẻ và giao quốc tế (chỉ trả bằng thẻ) để tắt
 * cho tới khi có hợp đồng cổng thanh toán thật; tài khoản nhận tiền để trống cho admin
 * tự nhập số tài khoản thật.
 */
export const INITIAL_SHOP_SETTINGS: ShopSettings = {
  memberDepositAmount: DEFAULT_MEMBER_DEPOSIT,
  bank: { bankName: '', accountNumber: '', accountHolder: '' },
  cardPayments: false,
  international: { ...DEFAULT_INTERNATIONAL_SHIPPING, enabled: false },
};

/** Mã giảm giá có sẵn. `validDays`: còn hạn bao nhiêu ngày kể từ lúc tạo. */
export interface CouponTemplate extends Omit<Coupon, 'expiresAt'> {
  validDays: number;
  /** Chỉ dùng cho đơn đầu tiên của mỗi tài khoản */
  firstOrderOnly?: boolean;
}

export const DEFAULT_COUPONS: readonly CouponTemplate[] = [
  {
    code: 'TDNEW10',
    label: 'Giảm 10% cho khách mới (tối đa 150.000₫)',
    type: 'percent',
    value: 10,
    minSubtotal: 500_000,
    maxDiscount: 150_000,
    validDays: 30,
    firstOrderOnly: true,
  },
  {
    code: 'FREESHIP',
    label: 'Miễn phí vận chuyển toàn quốc',
    type: 'shipping',
    value: 0,
    minSubtotal: 300_000,
    validDays: 14,
  },
  {
    code: 'BAKUGAN200',
    label: 'Giảm ngay 200.000₫ cho đơn từ 2.000.000₫',
    type: 'amount',
    value: 200_000,
    minSubtotal: 2_000_000,
    validDays: 7,
  },
];

/** Mã giảm giá như web hiển thị, hạn tính từ `now`. */
export function couponFromTemplate(template: CouponTemplate, now = Date.now()): Coupon {
  const { validDays, firstOrderOnly: _firstOrderOnly, ...coupon } = template;
  return { ...coupon, expiresAt: new Date(now + validDays * DAY).toISOString() };
}

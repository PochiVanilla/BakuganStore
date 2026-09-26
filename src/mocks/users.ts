import type { Coupon, User } from '@/types';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (days: number): string => new Date(now - days * DAY).toISOString();

/** Tài khoản demo — đăng nhập bằng email này với bất kỳ mật khẩu ≥ 8 ký tự. */
export const DEMO_ACCOUNT = {
  email: 'demo@tdbakugan.vn',
  password: 'Bakugan123',
} as const;

/**
 * Tài khoản quản trị của bản demo. Khác tài khoản khách, tài khoản này bắt
 * buộc đúng mật khẩu. Khi có backend thật, xoá hằng số này.
 */
export const ADMIN_ACCOUNT = {
  email: 'admin@tdbakugan.vn',
  password: 'TdAdmin@2026',
} as const;

export const MOCK_USER: User = {
  id: 'usr-001',
  fullName: 'Nguyễn Minh Khôi',
  email: DEMO_ACCOUNT.email,
  phone: '0912345678',
  createdAt: daysAgo(420),
  role: 'customer',
  gender: 'male',
  birthday: '1998-03-14',
  bankAccount: {
    bankName: 'Vietcombank',
    accountNumber: '0071000123456',
    accountHolder: 'NGUYEN MINH KHOI',
  },
  addresses: [
    {
      id: 'adr-001',
      label: 'Nhà riêng',
      receiverName: 'Nguyễn Minh Khôi',
      phone: '0912345678',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      street: '128 Lê Lợi',
      isDefault: true,
    },
    {
      id: 'adr-002',
      label: 'Văn phòng',
      receiverName: 'Nguyễn Minh Khôi',
      phone: '0987654321',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 3',
      ward: 'Phường Võ Thị Sáu',
      street: 'Tầng 7, 45 Nguyễn Đình Chiểu',
      isDefault: false,
    },
  ],
};

export const MOCK_COUPONS: Coupon[] = [
  {
    code: 'TDNEW10',
    label: 'Giảm 10% cho khách mới (tối đa 150.000₫)',
    type: 'percent',
    value: 10,
    minSubtotal: 500_000,
    maxDiscount: 150_000,
    expiresAt: new Date(now + 30 * DAY).toISOString(),
  },
  {
    code: 'FREESHIP',
    label: 'Miễn phí vận chuyển toàn quốc',
    type: 'shipping',
    value: 0,
    minSubtotal: 300_000,
    expiresAt: new Date(now + 14 * DAY).toISOString(),
  },
  {
    code: 'BAKUGAN200',
    label: 'Giảm ngay 200.000₫ cho đơn từ 2.000.000₫',
    type: 'amount',
    value: 200_000,
    minSubtotal: 2_000_000,
    expiresAt: new Date(now + 7 * DAY).toISOString(),
  },
];

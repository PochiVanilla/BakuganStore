import type { Coupon, Order, User } from '@/types';
import { MOCK_PRODUCTS } from './products';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (days: number): string => new Date(now - days * DAY).toISOString();

/** Tài khoản demo — đăng nhập bằng email này với bất kỳ mật khẩu ≥ 8 ký tự. */
export const DEMO_ACCOUNT = {
  email: 'demo@tdbakugan.vn',
  password: 'Bakugan123',
} as const;

export const MOCK_USER: User = {
  id: 'usr-001',
  fullName: 'Nguyễn Minh Khôi',
  email: DEMO_ACCOUNT.email,
  phone: '0912345678',
  createdAt: daysAgo(420),
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

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-001',
    code: 'TD2609A17',
    items: MOCK_PRODUCTS.slice(0, 2).map((product) => ({
      productId: product.id,
      name: product.name,
      image: product.images[0]!,
      price: product.price,
      quantity: 1,
    })),
    subtotal: MOCK_PRODUCTS[0]!.price + MOCK_PRODUCTS[1]!.price,
    shippingFee: 0,
    discount: 100_000,
    total: MOCK_PRODUCTS[0]!.price + MOCK_PRODUCTS[1]!.price - 100_000,
    status: 'shipping',
    createdAt: daysAgo(2),
    receiverName: 'Nguyễn Minh Khôi',
    phone: '0912345678',
    addressLine: '128 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'cod',
  },
  {
    id: 'ord-002',
    code: 'TD2508B04',
    items: MOCK_PRODUCTS.slice(5, 7).map((product) => ({
      productId: product.id,
      name: product.name,
      image: product.images[0]!,
      price: product.price,
      quantity: 1,
    })),
    subtotal: MOCK_PRODUCTS[5]!.price + MOCK_PRODUCTS[6]!.price,
    shippingFee: 30_000,
    discount: 0,
    total: MOCK_PRODUCTS[5]!.price + MOCK_PRODUCTS[6]!.price + 30_000,
    status: 'completed',
    createdAt: daysAgo(28),
    receiverName: 'Nguyễn Minh Khôi',
    phone: '0912345678',
    addressLine: '128 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'bank-transfer',
  },
  {
    id: 'ord-003',
    code: 'TD2507C22',
    items: MOCK_PRODUCTS.slice(20, 22).map((product) => ({
      productId: product.id,
      name: product.name,
      image: product.images[0]!,
      price: product.price,
      quantity: 2,
    })),
    subtotal: (MOCK_PRODUCTS[20]!.price + MOCK_PRODUCTS[21]!.price) * 2,
    shippingFee: 0,
    discount: 0,
    total: (MOCK_PRODUCTS[20]!.price + MOCK_PRODUCTS[21]!.price) * 2,
    status: 'completed',
    createdAt: daysAgo(63),
    receiverName: 'Nguyễn Minh Khôi',
    phone: '0987654321',
    addressLine: 'Tầng 7, 45 Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    paymentMethod: 'momo',
  },
  {
    id: 'ord-004',
    code: 'TD2506D09',
    items: MOCK_PRODUCTS.slice(12, 13).map((product) => ({
      productId: product.id,
      name: product.name,
      image: product.images[0]!,
      price: product.price,
      quantity: 1,
    })),
    subtotal: MOCK_PRODUCTS[12]!.price,
    shippingFee: 30_000,
    discount: 0,
    total: MOCK_PRODUCTS[12]!.price + 30_000,
    status: 'cancelled',
    createdAt: daysAgo(94),
    receiverName: 'Nguyễn Minh Khôi',
    phone: '0912345678',
    addressLine: '128 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'cod',
  },
];

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

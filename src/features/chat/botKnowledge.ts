import type { BotTopicId, Coupon, Order, OrderStatus, Product } from '@/types';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, SHOP_INFO } from '@/constants/routes';
import { ATTRIBUTE_META, CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/constants/orders';
import { buildAuctionRules } from '@/features/auction/auctionRuleText';
import { formatCurrency, formatDate } from '@/utils/format';

/* ============================================================
   Những gì trợ lý AI được phép biết.

   Dữ kiện chỉ được đưa vào khi chủ đề tương ứng đang bật, nên tắt một
   chủ đề trong trang cài đặt là bot không còn dữ liệu để trả lời việc đó.
   ============================================================ */

export const SHIPPING_POLICY = [
  `Phí vận chuyển cố định ${formatCurrency(SHIPPING_FEE)} mọi đơn, miễn phí cho đơn từ ${formatCurrency(FREE_SHIPPING_THRESHOLD)}.`,
  'Nội thành TP.HCM nhận hàng trong 1 – 2 ngày làm việc; tỉnh thành khác 2 – 5 ngày làm việc.',
  'Dịp lễ có thể chậm thêm 1 – 2 ngày. Mọi đơn đều có mã vận đơn và được đóng gói chống sốc hai lớp.',
  'Khách được đồng kiểm với shipper trước khi thanh toán.',
];

export const PAYMENT_POLICY = [
  'Hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng và ví MoMo.',
  'Đơn chuyển khoản được xác nhận trong giờ làm việc; quá 24 giờ chưa nhận được tiền thì đơn tự huỷ.',
  'Hàng đấu giá cần thanh toán trong 48 giờ sau khi thắng phiên.',
];

export const RETURN_POLICY = [
  'Đổi trả trong 7 ngày kể từ khi nhận hàng nếu lỗi cơ cấu bung nở, mất từ tính nam châm, giao sai mẫu/hệ/tình trạng hoặc hư hỏng khi vận chuyển (cần ảnh/video mở hộp).',
  'Không áp dụng cho hàng đã qua sử dụng có va đập do người mua, hàng thắng đấu giá, hoặc quá 7 ngày.',
  'Shop xác nhận yêu cầu đổi trả trong 24 giờ làm việc; hoàn tiền trong 3 – 5 ngày làm việc.',
];

export interface BotProductFact {
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
  attribute: string;
  series: string;
  condition: string;
  gPower: number;
}

export interface BotOrderFact {
  code: string;
  status: OrderStatus;
  statusLabel: string;
  createdAt: string;
  total: number;
  payment: string;
  paymentStatus: string;
  items: string[];
}

export interface BotKnowledge {
  customerName?: string;
  products: BotProductFact[];
  orders: BotOrderFact[];
  coupons: Array<Pick<Coupon, 'code' | 'label' | 'expiresAt'>>;
}

export function buildKnowledge(input: {
  customerName?: string;
  products: readonly Product[];
  orders: readonly Order[];
  coupons: readonly Coupon[];
}): BotKnowledge {
  return {
    customerName: input.customerName,
    products: input.products
      .filter((product) => !product.isHidden)
      .map((product) => ({
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        stock: product.stock,
        attribute: ATTRIBUTE_META[product.attribute].label,
        series: SERIES_META[product.series].label,
        condition: CONDITION_LABELS[product.condition],
        gPower: product.gPower,
      })),
    orders: input.orders.slice(0, 10).map((order) => ({
      code: order.code,
      status: order.status,
      statusLabel: ORDER_STATUS_LABELS[order.status],
      createdAt: order.createdAt,
      total: order.total,
      payment: PAYMENT_METHOD_LABELS[order.paymentMethod],
      paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus],
      items: order.items.map((item) => `${item.name} ×${item.quantity}`),
    })),
    coupons: input.coupons
      .filter((coupon) => new Date(coupon.expiresAt).getTime() > Date.now())
      .map(({ code, label, expiresAt }) => ({ code, label, expiresAt })),
  };
}

export function describeProduct(product: BotProductFact): string {
  const sale = product.originalPrice ? ` (giá gốc ${formatCurrency(product.originalPrice)})` : '';
  const stock = product.stock > 0 ? `còn ${product.stock}` : 'hết hàng';
  return `${product.name} — ${formatCurrency(product.price)}${sale} — ${stock} — hệ ${product.attribute}, dòng ${product.series}, ${product.condition}, ${product.gPower}G`;
}

export function describeOrder(order: BotOrderFact): string {
  return `Đơn #${order.code}: ${order.statusLabel}, đặt ngày ${formatDate(order.createdAt)}, tổng ${formatCurrency(order.total)}, ${order.payment} (${order.paymentStatus.toLowerCase()}). Gồm: ${order.items.join(', ')}`;
}

/** Chuyển thành các dòng dữ kiện gửi cho AI — chỉ theo những chủ đề đang bật. */
export function knowledgeToFacts(knowledge: BotKnowledge, topics: readonly BotTopicId[]): string[] {
  const on = new Set(topics);
  const facts: string[] = [];

  if (knowledge.customerName) facts.push(`Khách đang chat: ${knowledge.customerName}.`);
  if (on.has('store-info')) {
    facts.push(
      `Cửa hàng ${SHOP_INFO.name}: ${SHOP_INFO.address}. Giờ làm việc ${SHOP_INFO.workingHours}. Hotline/Zalo ${SHOP_INFO.hotline}, email ${SHOP_INFO.email}.`,
    );
  }
  if (on.has('shipping')) facts.push(...SHIPPING_POLICY.map((line) => `[Vận chuyển] ${line}`));
  if (on.has('payment')) facts.push(...PAYMENT_POLICY.map((line) => `[Thanh toán] ${line}`));
  if (on.has('returns')) facts.push(...RETURN_POLICY.map((line) => `[Đổi trả] ${line}`));
  if (on.has('auction-rules')) {
    facts.push(...buildAuctionRules().map((rule) => `[Đấu giá] ${rule.title}: ${rule.text}`));
  }
  if (on.has('promotions')) {
    facts.push(
      ...(knowledge.coupons.length > 0
        ? knowledge.coupons.map(
            (coupon) =>
              `[Mã giảm giá] ${coupon.code}: ${coupon.label}, hạn đến ${formatDate(coupon.expiresAt)}.`,
          )
        : ['[Mã giảm giá] Hiện không có mã nào đang chạy.']),
    );
  }
  if (on.has('order-status')) {
    facts.push(
      ...(knowledge.orders.length > 0
        ? knowledge.orders.map((order) => `[Đơn của khách] ${describeOrder(order)}`)
        : ['[Đơn của khách] Khách này chưa có đơn nào (hoặc chưa đăng nhập).']),
    );
  }
  if (on.has('product-info')) {
    facts.push(
      ...knowledge.products.slice(0, 50).map((product) => `[Sản phẩm] ${describeProduct(product)}`),
    );
  }
  return facts;
}

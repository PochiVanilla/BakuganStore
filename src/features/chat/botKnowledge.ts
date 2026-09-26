import type { BotTopicId, Coupon, Order, OrderStatus, Product } from '@/types';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES } from '@/types';
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

/** Cam kết in trên trang chủ — bot dùng lại đúng nội dung này. */
export const SHOP_COMMITMENTS = [
  'Hàng chính hãng: mọi sản phẩm nhập từ nguồn uy tín, kiểm tra mã series và lực nam châm trước khi lên kệ.',
  'Kiểm tra kỹ từng quả: thử cơ cấu bung nở 10 lần, vệ sinh khoang nam châm và chụp ảnh thực tế cho từng sản phẩm.',
  'Đóng gói chống sốc: bọc xốp hai lớp, hộp cứng, quay video khi đóng gói cho mọi đơn trên 1 triệu đồng.',
];

/** Cách đặt hàng hiện tại (thanh toán online trên web chưa mở). */
export const ORDERING_GUIDE =
  'Đặt hàng: khách nhắn tên mẫu, số lượng và địa chỉ nhận hàng qua chat hoặc Zalo; nhân viên xác nhận còn hàng, báo tổng tiền và cách thanh toán rồi lên đơn.';

export const CANCEL_GUIDE =
  'Huỷ đơn: khách đã đăng nhập tự huỷ được đơn còn "Chờ xác nhận" và chưa thanh toán bằng cách nhắn "huỷ đơn" kèm mã đơn; đơn đã xác nhận, đang giao hoặc đã trả tiền cần nhân viên xử lý.';

export const ACCOUNT_GUIDE =
  'Tài khoản: đăng ký ở mục Đăng ký (góc phải trên cùng), quên mật khẩu thì bấm "Quên mật khẩu?" ở trang Đăng nhập để nhận link đặt lại qua email. Cần đăng nhập để đặt giá đấu giá và xem đơn hàng.';

/** Kiến thức chung về Bakugan (không phải thông tin riêng của shop). */
export const BAKUGAN_BASICS = [
  'Bakugan là đồ chơi chiến đấu hình quả cầu: bên trong có nam châm, khi lăn tới thẻ Gate có miếng kim loại thì quả cầu bung ra thành chiến binh. Dòng đồ chơi và phim hoạt hình ra đời năm 2007.',
  'Cách chơi cơ bản (luật Battle Brawlers): mỗi người có 3 Bakugan, 3 thẻ Gate và 3 thẻ Năng lực. Đặt thẻ Gate lên sàn rồi lần lượt lăn Bakugan; hai Bakugan cùng đứng trên một thẻ thì so G-Power (cộng hiệu ứng thẻ), bên cao hơn giành thẻ. Ai giành đủ 3 thẻ Gate trước là thắng.',
  'G-Power là chỉ số sức mạnh của mỗi Bakugan (thường vài trăm tới hơn 1000G), dùng để so khi hai Bakugan đấu nhau; G-Power càng cao càng mạnh.',
];

export function describeAttributes(): string {
  return BAKUGAN_ATTRIBUTES.map((value) => {
    const meta = ATTRIBUTE_META[value];
    return `${meta.label} (${meta.element}): ${meta.description.split('—')[1]?.trim() ?? meta.description}`;
  }).join('; ');
}

export function describeSeries(): string {
  return BAKUGAN_SERIES.map((value) => {
    const meta = SERIES_META[value];
    return `${meta.label} (${meta.years})`;
  }).join(', ');
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_ARRIVAL_MS = 30 * DAY_MS;

export interface BotProductFact {
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
  attribute: string;
  /** Mã hệ (pyrus, aquos…) để lọc chính xác */
  attributeId: string;
  series: string;
  seriesId: string;
  condition: string;
  gPower: number;
  soldCount: number;
  isRare: boolean;
  isNew: boolean;
  /** Số ngày kể từ khi lên kệ, để xếp hàng mới về */
  ageDays: number;
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
  /** Khách đã đăng nhập (mới tra được đơn và tự huỷ đơn) */
  isSignedIn: boolean;
  products: BotProductFact[];
  orders: BotOrderFact[];
  coupons: Array<Pick<Coupon, 'code' | 'label' | 'expiresAt'>>;
}

export function buildKnowledge(input: {
  customerName?: string;
  isSignedIn: boolean;
  products: readonly Product[];
  orders: readonly Order[];
  coupons: readonly Coupon[];
  now?: number;
}): BotKnowledge {
  const now = input.now ?? Date.now();
  return {
    customerName: input.customerName,
    isSignedIn: input.isSignedIn,
    products: input.products
      .filter((product) => !product.isHidden)
      .map((product) => ({
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        stock: product.stock,
        attribute: ATTRIBUTE_META[product.attribute].label,
        attributeId: product.attribute,
        series: SERIES_META[product.series].label,
        seriesId: product.series,
        condition: CONDITION_LABELS[product.condition],
        gPower: product.gPower,
        soldCount: product.soldCount,
        isRare: product.isRare,
        isNew: now - new Date(product.createdAt).getTime() <= NEW_ARRIVAL_MS,
        ageDays: Math.max(0, Math.floor((now - new Date(product.createdAt).getTime()) / DAY_MS)),
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
      .filter((coupon) => new Date(coupon.expiresAt).getTime() > now)
      .map(({ code, label, expiresAt }) => ({ code, label, expiresAt })),
  };
}

export function describeProduct(product: BotProductFact): string {
  const sale = product.originalPrice ? ` (giá gốc ${formatCurrency(product.originalPrice)})` : '';
  const stock = product.stock > 0 ? `còn ${product.stock}` : 'hết hàng';
  const tags = [product.isRare && 'hàng hiếm', product.isNew && 'hàng mới về']
    .filter(Boolean)
    .join(', ');
  return `${product.name} — ${formatCurrency(product.price)}${sale} — ${stock} — hệ ${product.attribute}, dòng ${product.series}, ${product.condition}, ${product.gPower}G${tags ? ` (${tags})` : ''}`;
}

/** Thời gian giao dự kiến theo trạng thái đơn, dùng khi khách hỏi "bao giờ nhận". */
export function deliveryHint(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Shop sẽ gọi xác nhận trong giờ làm việc, sau đó đóng gói và gửi đi.';
    case 'confirmed':
    case 'packing':
      return 'Shop đang chuẩn bị hàng, thường gửi đi trong ngày làm việc kế tiếp.';
    case 'shipping':
      return 'Nội thành TP.HCM thường nhận trong 1 – 2 ngày, tỉnh khác 2 – 5 ngày làm việc.';
    default:
      return '';
  }
}

export function describeOrder(order: BotOrderFact): string {
  const hint = deliveryHint(order.status);
  return `Đơn #${order.code}: ${order.statusLabel}, đặt ngày ${formatDate(order.createdAt)}, tổng ${formatCurrency(order.total)}, ${order.payment} (${order.paymentStatus.toLowerCase()}). Gồm: ${order.items.join(', ')}.${hint ? ` ${hint}` : ''}`;
}

/** Chuyển thành các dòng dữ kiện gửi cho AI — chỉ theo những chủ đề đang bật. */
export function knowledgeToFacts(knowledge: BotKnowledge, topics: readonly BotTopicId[]): string[] {
  const on = new Set(topics);
  const facts: string[] = [];

  facts.push(
    knowledge.customerName
      ? `Khách đang chat: ${knowledge.customerName} (${knowledge.isSignedIn ? 'đã đăng nhập' : 'chưa đăng nhập'}).`
      : 'Khách chưa đăng nhập.',
  );
  facts.push(`[Đặt hàng] ${ORDERING_GUIDE}`);
  if (on.has('store-info')) {
    facts.push(
      `[Cửa hàng] ${SHOP_INFO.name}: ${SHOP_INFO.address}. Giờ làm việc ${SHOP_INFO.workingHours}. Hotline/Zalo ${SHOP_INFO.hotline}, email ${SHOP_INFO.email}.`,
      ...SHOP_COMMITMENTS.map((line) => `[Cam kết] ${line}`),
      `[Tài khoản] ${ACCOUNT_GUIDE}`,
    );
  }
  if (on.has('shipping')) facts.push(...SHIPPING_POLICY.map((line) => `[Vận chuyển] ${line}`));
  if (on.has('payment')) facts.push(...PAYMENT_POLICY.map((line) => `[Thanh toán] ${line}`));
  if (on.has('returns')) facts.push(...RETURN_POLICY.map((line) => `[Đổi trả] ${line}`));
  if (on.has('order-cancel')) facts.push(`[Huỷ đơn] ${CANCEL_GUIDE}`);
  if (on.has('auction-rules')) {
    facts.push(...buildAuctionRules().map((rule) => `[Đấu giá] ${rule.title}: ${rule.text}`));
  }
  if (on.has('bakugan-knowledge')) {
    facts.push(
      ...BAKUGAN_BASICS.map((line) => `[Kiến thức] ${line}`),
      `[Kiến thức] 6 hệ: ${describeAttributes()}.`,
      `[Kiến thức] Các dòng shop đang bán: ${describeSeries()}.`,
    );
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
        : [
            knowledge.isSignedIn
              ? '[Đơn của khách] Khách này chưa có đơn nào.'
              : '[Đơn của khách] Khách chưa đăng nhập nên không xem được đơn.',
          ]),
    );
  }
  if (on.has('product-info')) {
    facts.push(
      ...knowledge.products.slice(0, 60).map((product) => `[Sản phẩm] ${describeProduct(product)}`),
    );
  }
  return facts;
}

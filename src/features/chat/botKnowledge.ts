import type {
  BakuganAttribute,
  BakuganSeries,
  BotTopicId,
  ChatLink,
  Coupon,
  FeedPost,
  FeedStatus,
  MemberLevel,
  Order,
  OrderStatus,
  ProductCondition,
} from '@/types';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES } from '@/types';
import { FREE_SHIPPING_THRESHOLD, ROUTES, SHIPPING_FEE, SHOP_INFO } from '@/constants/routes';
import {
  ATTRIBUTE_META,
  AUCTION_MIN_LEVEL,
  attributeKeyOf,
  conditionGradeOf,
  FEED_STATUS_LABELS,
  PURCHASES_FOR_LV2,
  SERIES_META,
} from '@/constants/catalog';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/constants/orders';
import { CARD_HOLD_MINUTES, DELIVERY_ESTIMATE, ZONE_LABELS } from '@/constants/shipping';
import { buildAuctionRules } from '@/features/auction/auctionRuleText';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

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
  'Hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng và ví MoMo — chọn ở bước Thanh toán (Giỏ hàng → Tiến hành thanh toán).',
  'Đơn chuyển khoản được xác nhận trong giờ làm việc; quá 24 giờ chưa nhận được tiền thì đơn tự huỷ và các con Bakugan trong đơn được mở bán lại.',
  'Hàng đấu giá cần thanh toán trong 48 giờ sau khi thắng phiên.',
  'Có vấn đề về tiền (bị trừ tiền nhưng đơn đã huỷ, trả hai lần, sai số tiền…): hệ thống không tự hoàn tiền; khách nhắn shop để nhân viên kiểm tra và giải quyết trực tiếp.',
];

export const RETURN_POLICY = [
  'Đổi trả trong 7 ngày kể từ khi nhận hàng nếu lỗi cơ cấu bung nở, mất từ tính nam châm, giao sai con (sai mã BK) hoặc hư hỏng khi vận chuyển (cần ảnh/video mở hộp).',
  'Không áp dụng cho tình trạng đã ghi rõ trong feed (trầy, lỏng khớp, thiếu thẻ…), va đập do người mua, hàng thắng đấu giá, hoặc quá 7 ngày.',
  'Shop xác nhận yêu cầu đổi trả trong 24 giờ làm việc; hoàn tiền trong 3 – 5 ngày làm việc.',
];

/** Cam kết in trên trang chủ — bot dùng lại đúng nội dung này. */
export const SHOP_COMMITMENTS = [
  'Hàng chính hãng: mọi Bakugan nhập từ nguồn uy tín, có kiểm tra mã series và lực nam châm trước khi đăng feed.',
  'Kiểm tra kỹ từng quả: thử cơ cấu bung nở 10 lần, vệ sinh khoang nam châm, ghi rõ tình trạng riêng của từng con.',
  'Đóng gói chống sốc: bọc xốp hai lớp, hộp cứng, quay video khi đóng gói cho mọi đơn trên 1 triệu đồng.',
];

/** Cách shop bán hàng: theo feed, mỗi con là duy nhất. */
export const FEED_GUIDE = [
  'Shop bán theo "feed": mỗi feed là một lô Bakugan, có ảnh chụp cả lô và danh sách từng con. Feed mới thường đăng trước rồi mở bán lúc 20:00; trước giờ mở bán khách xem trước được nhưng chưa đặt được.',
  'Mỗi con Bakugan là duy nhất: có tên và mã riêng (VD: BK-0231), tình trạng riêng; không có nhiều con giống hệt nhau. Con đã có người mua hiện chữ SOLD.',
  'Shop không nhận đặt trước hay giữ hàng; muốn tìm mẫu nào thì theo dõi mục Feed bán hoặc dùng ô tìm kiếm theo tên / mã BK.',
];

/** Cách đặt hàng trên web. */
export const ORDERING_GUIDE =
  'Đặt hàng: đăng nhập, mở feed đang bán, bấm "Thêm vào giỏ" ở con muốn mua, vào Giỏ hàng bấm "Tiến hành thanh toán" rồi điền địa chỉ (trong nước hoặc nước ngoài) và chọn cách trả tiền. Mỗi mã chỉ có một con nên ai chốt đơn trước được trước.';

export const CANCEL_GUIDE =
  'Huỷ đơn: khách đã đăng nhập tự huỷ được đơn còn "Chờ xác nhận" và chưa thanh toán bằng cách nhắn "huỷ đơn" kèm mã đơn — các con trong đơn được mở bán lại; đơn đã xác nhận, đang giao hoặc đã trả tiền cần nhân viên xử lý.';

export const ACCOUNT_GUIDE =
  'Tài khoản: đăng ký ở mục Đăng ký (góc phải trên cùng), quên mật khẩu thì bấm "Quên mật khẩu?" ở trang Đăng nhập để nhận link đặt lại qua email. Cần đăng nhập để đặt hàng, xem đơn và đấu giá.';

/** Luật hạng thành viên (được tham gia đấu giá hay chưa). */
export function membershipRules(depositAmount: number): string[] {
  return [
    `Tài khoản mới là thành viên Lv1: mua hàng bình thường. Muốn đặt giá trong phiên đấu giá phải là thành viên Lv${AUCTION_MIN_LEVEL} trở lên.`,
    `Lên Lv${AUCTION_MIN_LEVEL} bằng MỘT trong ba cách: (1) nhận đủ ${PURCHASES_FOR_LV2} con Bakugan mua ở TD shop (tính khi đơn đã giao xong) — tự động; (2) nạp ${formatCurrency(depositAmount)} tiền thành viên theo hướng dẫn ở Tài khoản → Hạng thành viên, shop đối soát rồi xác nhận; (3) gửi yêu cầu để admin xét duyệt (khách quen, mua trực tiếp tại shop…).`,
    'Xem hạng hiện tại và tiến độ ở Tài khoản → Hạng thành viên.',
  ];
}

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

/** Một con Bakugan còn bán trên web (đang mở bán hoặc sắp mở bán). */
export interface BotItemFact {
  code: string;
  name: string;
  price: number;
  /** Hệ shop tự gõ: "Pyrus" */
  attribute: string;
  /** Hệ quen thuộc nhận ra từ chữ shop gõ — để tư vấn theo hệ; không nhận ra thì trống */
  attributeId?: BakuganAttribute;
  series?: string;
  seriesId?: BakuganSeries;
  /** Tình trạng shop tự gõ */
  condition?: string;
  /** Nhóm tình trạng đoán từ chữ shop gõ — để tư vấn; không đoán được thì trống */
  conditionId?: ProductCondition;
  feedNumber: number;
  /** Đặt mua được ngay; false nghĩa là feed chưa tới giờ mở bán */
  onSale: boolean;
  opensAt: string;
}

export interface BotFeedFact {
  number: number;
  title: string;
  status: FeedStatus;
  opensAt: string;
  itemCount: number;
  availableCount: number;
  priceRange?: { min: number; max: number };
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

export interface BotMembershipFact {
  depositAmount: number;
  /** Shop đã điền số tài khoản trong cài đặt chưa (chưa thì nhân viên gửi qua chat) */
  bankConfigured: boolean;
  /** Chỉ có khi khách đã đăng nhập */
  level?: MemberLevel;
  purchasedCount?: number;
  pendingRequest?: 'deposit' | 'review';
}

export interface BotKnowledge {
  customerName?: string;
  /** Khách đã đăng nhập (mới tra được đơn và tự huỷ đơn) */
  isSignedIn: boolean;
  /** Feed trên web, mới nhất trước */
  feeds: BotFeedFact[];
  /** Những con còn bán trên các feed (đang mở bán trước) */
  items: BotItemFact[];
  orders: BotOrderFact[];
  coupons: Array<Pick<Coupon, 'code' | 'label' | 'expiresAt'>>;
  membership: BotMembershipFact;
  checkout: BotCheckoutFact;
}

/** Thẻ và giao quốc tế theo cài đặt hiện tại của admin */
export interface BotCheckoutFact {
  cardPayments: boolean;
  /** Có gửi ra nước ngoài (đơn quốc tế chỉ trả bằng thẻ) */
  international: boolean;
  feeAsia: number;
  feeWorld: number;
}

/** Câu trả lời về trả bằng thẻ; shop tắt nhận thẻ thì không có. */
export function cardPaymentLine(checkout: BotCheckoutFact): string | undefined {
  if (!checkout.cardPayments) return undefined;
  return `Nhận thẻ Visa / Mastercard / JCB (cả thẻ phát hành ở nước ngoài): chọn "Thẻ quốc tế" ở bước Thanh toán, nhập thẻ trên trang bảo mật của cổng thanh toán và xác thực 3-D Secure — shop không lưu số thẻ. Hàng được giữ ${CARD_HOLD_MINUTES} phút để bạn trả, quá hạn đơn tự huỷ.`;
}

export function internationalShippingLine(checkout: BotCheckoutFact): string {
  if (!checkout.international) return 'Hiện shop chỉ giao hàng trong Việt Nam.';
  return `Có gửi ra nước ngoài: ở bước Thanh toán chọn "Nước ngoài", đơn quốc tế trả bằng thẻ Visa / Mastercard / JCB. Chuyển phát quốc tế có mã theo dõi, ${DELIVERY_ESTIMATE.international}; phí mỗi đơn ${formatCurrency(checkout.feeAsia)} (${ZONE_LABELS.asia}) hoặc ${formatCurrency(checkout.feeWorld)} (${ZONE_LABELS.world.toLowerCase()}). Thuế nhập khẩu (nếu có) do người nhận trả.`;
}

export function buildKnowledge(input: {
  customerName?: string;
  isSignedIn: boolean;
  feeds: readonly FeedPost[];
  orders: readonly Order[];
  coupons: readonly Coupon[];
  membership: BotMembershipFact;
  checkout: BotCheckoutFact;
  now?: number;
}): BotKnowledge {
  const now = input.now ?? Date.now();
  const feeds = [...input.feeds].sort((a, b) => b.number - a.number);
  const items = feeds
    .flatMap((feed) =>
      feed.items
        .filter((item) => item.status === 'available')
        .map((item): BotItemFact => ({
          code: item.code,
          name: item.name,
          price: item.price,
          attribute: item.attribute,
          attributeId: attributeKeyOf(item.attribute),
          series: item.series ? SERIES_META[item.series].label : undefined,
          seriesId: item.series,
          condition: item.condition,
          conditionId: conditionGradeOf(item.condition),
          feedNumber: feed.number,
          onSale: item.onSale,
          opensAt: feed.opensAt,
        })),
    )
    // Con mua được ngay lên trước, rồi tới feed mới hơn.
    .sort((a, b) => Number(b.onSale) - Number(a.onSale) || b.feedNumber - a.feedNumber);

  return {
    customerName: input.customerName,
    isSignedIn: input.isSignedIn,
    feeds: feeds.slice(0, 12).map((feed) => ({
      number: feed.number,
      title: feed.title,
      status: feed.status,
      opensAt: feed.opensAt,
      itemCount: feed.itemCount,
      availableCount: feed.itemCount - feed.soldCount,
      priceRange: feed.priceRange,
    })),
    items,
    orders: input.orders.slice(0, 10).map((order) => ({
      code: order.code,
      status: order.status,
      statusLabel: ORDER_STATUS_LABELS[order.status],
      createdAt: order.createdAt,
      total: order.total,
      payment: PAYMENT_METHOD_LABELS[order.paymentMethod],
      paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus],
      items: order.items.map((item) => (item.code ? `${item.code} ${item.name}` : item.name)),
    })),
    coupons: input.coupons
      .filter((coupon) => new Date(coupon.expiresAt).getTime() > now)
      .map(({ code, label, expiresAt }) => ({ code, label, expiresAt })),
    membership: input.membership,
    checkout: input.checkout,
  };
}

/** "mở bán 20:00 27/09" hoặc "đang bán" */
export function saleState(item: Pick<BotItemFact, 'onSale' | 'opensAt'>): string {
  return item.onSale ? 'đang bán' : `mở bán ${formatDateTime(item.opensAt)}`;
}

export function describeItem(item: BotItemFact): string {
  const details = [
    item.attribute && `hệ ${item.attribute}`,
    item.series && `dòng ${item.series}`,
    item.condition,
  ]
    .filter(Boolean)
    .join(', ');
  return `${item.code} ${item.name} — ${formatCurrency(item.price)} — ${details} — feed #${item.feedNumber}, ${saleState(item)}`;
}

export function describeFeed(feed: BotFeedFact): string {
  const state =
    feed.status === 'upcoming'
      ? `${FEED_STATUS_LABELS.upcoming.toLowerCase()} lúc ${formatDateTime(feed.opensAt)}`
      : FEED_STATUS_LABELS[feed.status].toLowerCase();
  const range = feed.priceRange;
  const price =
    range && feed.availableCount > 0
      ? range.min === range.max
        ? `, giá ${formatCurrency(range.min)}`
        : `, giá ${formatCurrency(range.min)} – ${formatCurrency(range.max)}`
      : '';
  return `Feed #${feed.number} "${feed.title}": ${state}, còn ${feed.availableCount}/${feed.itemCount} con${price}`;
}

/** Nút mở trang riêng của con Bakugan (ảnh, video, thêm vào giỏ). */
export function itemLink(item: Pick<BotItemFact, 'code' | 'name' | 'price'>): ChatLink {
  return {
    label: `${item.code} · ${item.name} · ${formatCurrency(item.price)}`,
    to: ROUTES.itemDetail(item.code),
  };
}

export function feedLink(feed: Pick<BotFeedFact, 'number' | 'title'>): ChatLink {
  return { label: `Feed #${feed.number} · ${feed.title}`, to: ROUTES.feedDetail(feed.number) };
}

const MAX_LINKS = 4;

/**
 * Gắn nút bấm cho những mã BK và feed có nhắc tới trong câu trả lời
 * (câu của Gemini chỉ là chữ, khách bấm nút để mở đúng con đó).
 */
export function linksFromText(text: string, knowledge: BotKnowledge): ChatLink[] {
  const links: ChatLink[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/\bBK-?\s?(\d{4})\b/gi)) {
    const code = `BK-${match[1]}`;
    const item = knowledge.items.find((entry) => entry.code === code);
    if (item && !seen.has(code)) {
      seen.add(code);
      links.push(itemLink(item));
    }
  }
  for (const match of text.matchAll(/\bfeed\s*#?\s*(\d{1,4})\b/gi)) {
    const feed = knowledge.feeds.find((entry) => entry.number === Number(match[1]));
    const key = `feed-${match[1]}`;
    if (feed && !seen.has(key)) {
      seen.add(key);
      links.push(feedLink(feed));
    }
  }
  return links.slice(0, MAX_LINKS);
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
  const shown = order.items.slice(0, 5).join(', ');
  const more = order.items.length > 5 ? ` và ${order.items.length - 5} con khác` : '';
  return `Đơn #${order.code}: ${order.statusLabel}, đặt ngày ${formatDate(order.createdAt)}, tổng ${formatCurrency(order.total)}, ${order.payment} (${order.paymentStatus.toLowerCase()}). Gồm: ${shown}${more}.${hint ? ` ${hint}` : ''}`;
}

/** Hạng của khách đang chat, để bot nói đúng việc khách còn thiếu. */
export function describeMembership(membership: BotMembershipFact): string | undefined {
  if (!membership.level) return undefined;
  if (membership.level >= AUCTION_MIN_LEVEL) {
    return `Khách đang là thành viên Lv${membership.level}, đã được đặt giá đấu giá.`;
  }
  const pending =
    membership.pendingRequest === 'deposit'
      ? ' Khách đã báo nạp tiền, đang chờ shop xác nhận.'
      : membership.pendingRequest === 'review'
        ? ' Khách đã gửi yêu cầu xét duyệt, đang chờ admin.'
        : '';
  return `Khách đang là thành viên Lv${membership.level}, đã nhận ${membership.purchasedCount ?? 0}/${PURCHASES_FOR_LV2} con Bakugan mua ở shop.${pending}`;
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
  if (on.has('shipping')) {
    facts.push(
      ...SHIPPING_POLICY.map((line) => `[Vận chuyển] ${line}`),
      `[Vận chuyển] ${internationalShippingLine(knowledge.checkout)}`,
    );
  }
  if (on.has('payment')) {
    facts.push(...PAYMENT_POLICY.map((line) => `[Thanh toán] ${line}`));
    const card = cardPaymentLine(knowledge.checkout);
    if (card) facts.push(`[Thanh toán] ${card}`);
  }
  if (on.has('returns')) facts.push(...RETURN_POLICY.map((line) => `[Đổi trả] ${line}`));
  if (on.has('order-cancel')) facts.push(`[Huỷ đơn] ${CANCEL_GUIDE}`);
  if (on.has('auction-rules')) {
    facts.push(...buildAuctionRules().map((rule) => `[Đấu giá] ${rule.title}: ${rule.text}`));
  }
  if (on.has('membership')) {
    facts.push(
      ...membershipRules(knowledge.membership.depositAmount).map((line) => `[Thành viên] ${line}`),
    );
    const mine = describeMembership(knowledge.membership);
    if (mine) facts.push(`[Hạng của khách] ${mine}`);
  }
  if (on.has('bakugan-knowledge')) {
    facts.push(
      ...BAKUGAN_BASICS.map((line) => `[Kiến thức] ${line}`),
      `[Kiến thức] 6 hệ: ${describeAttributes()}.`,
      `[Kiến thức] Các dòng Bakugan: ${describeSeries()}.`,
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
    facts.push(...FEED_GUIDE.map((line) => `[Cách bán] ${line}`));
    facts.push(
      ...(knowledge.feeds.length > 0
        ? knowledge.feeds.slice(0, 10).map((feed) => `[Feed] ${describeFeed(feed)}.`)
        : ['[Feed] Hiện chưa có feed nào trên web.']),
    );
    facts.push(
      ...(knowledge.items.length > 0
        ? knowledge.items.slice(0, 60).map((item) => `[Bakugan còn bán] ${describeItem(item)}`)
        : ['[Bakugan còn bán] Hiện tất cả Bakugan trên web đều đã bán (SOLD).']),
    );
    if (knowledge.items.length > 60) {
      facts.push(
        `[Bakugan còn bán] Còn ${knowledge.items.length - 60} con khác — khách xem đủ ở mục Feed bán.`,
      );
    }
  }
  return facts;
}

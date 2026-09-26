import type { BotReply, BotTopicId } from '@/types';
import { SHOP_INFO } from '@/constants/routes';
import { normalizeSearch } from '@/utils/slugify';
import { formatDate } from '@/utils/format';
import {
  PAYMENT_POLICY,
  RETURN_POLICY,
  SHIPPING_POLICY,
  describeOrder,
  describeProduct,
  type BotKnowledge,
} from './botKnowledge';

/* ============================================================
   Bộ trả lời dự phòng theo từ khoá.

   Chạy khi chưa cấu hình GEMINI_API_KEY, khi hết hạn mức miễn phí hoặc
   khi mất mạng — khách vẫn được trả lời các câu cơ bản thay vì im lặng.
   Cùng tôn trọng danh sách chủ đề admin đã bật như AI thật.
   ============================================================ */

const normalize = (value: string): string => normalizeSearch(value.toLowerCase());

/** Những việc bot không bao giờ tự quyết — luôn chuyển nhân viên. */
const HANDOFF_KEYWORDS = [
  'nhan vien',
  'nguoi that',
  'gap admin',
  'gap shop',
  'khieu nai',
  'huy don',
  'hoan tien',
  'giu hang',
  'giu giup',
  'giu dum',
  'thu mua',
  'ban lai',
  'tra gop',
  'bot gia',
  'chiet khau',
  'lua dao',
];

const TOPIC_KEYWORDS: ReadonlyArray<readonly [BotTopicId, readonly string[]]> = [
  ['order-status', ['don hang', 'don cua', 'ma don', 'toi dau', 'giao chua', 'van don', 'don toi']],
  [
    'auction-rules',
    ['dau gia', 'ban tia', 'gia han', 'phien kin', 'dat gia', 'buoc gia', 'cong them gio'],
  ],
  ['promotions', ['ma giam', 'khuyen mai', 'voucher', 'coupon', 'freeship', 'uu dai', 'sale']],
  ['shipping', ['ship', 'giao hang', 'van chuyen', 'bao lau', 'may ngay', 'phi giao']],
  ['payment', ['thanh toan', 'chuyen khoan', 'momo', 'cod', 'tra tien', 'quet ma']],
  ['returns', ['doi tra', 'doi hang', 'tra hang', 'bao hanh', 'bi loi', 'hu hong', 'mat tu']],
  [
    'store-info',
    [
      'dia chi',
      'o dau',
      'cua hang',
      'gio mo',
      'may gio',
      'hotline',
      'so dien thoai',
      'zalo',
      'lien he',
    ],
  ],
  [
    'product-info',
    [
      'con hang',
      'het hang',
      'bao nhieu tien',
      'gia bao nhieu',
      'g-power',
      'gpower',
      'mau nao',
      'con con',
    ],
  ],
];

const ATTRIBUTE_WORDS = ['pyrus', 'aquos', 'subterra', 'haos', 'darkus', 'ventus'];
const STOP_WORDS = new Set([
  'shop',
  'con',
  'khong',
  'cho',
  'minh',
  'ban',
  'bakugan',
  'nay',
  'duoc',
  'gia',
  'hang',
  'nhieu',
  'bao',
  'nao',
  'the',
  'voi',
  'mot',
  'cua',
]);

const ORDER_CODE = /td\s?\d{4}[a-z]\d{2}/i;

function reply(text: string, handoff = false): BotReply {
  return { reply: text, handoff, source: 'rules' };
}

function detectTopic(text: string): BotTopicId | null {
  if (ORDER_CODE.test(text)) return 'order-status';
  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return topic;
  }
  if (ATTRIBUTE_WORDS.some((word) => text.includes(word))) return 'product-info';
  return null;
}

function answerOrder(text: string, knowledge: BotKnowledge): BotReply {
  const code = text.match(ORDER_CODE)?.[0]?.replace(/\s/g, '').toUpperCase();
  if (code) {
    const order = knowledge.orders.find((item) => item.code.toUpperCase() === code);
    if (order) return reply(describeOrder(order));
    return reply(
      `Mình không tìm thấy đơn #${code} trong tài khoản của bạn. Mình chuyển cho nhân viên kiểm tra giúp nhé.`,
      true,
    );
  }
  if (knowledge.orders.length === 0) {
    return reply(
      'Bạn đăng nhập tài khoản đã đặt hàng, hoặc gửi mã đơn (dạng TD2609A17) để mình tra giúp nhé.',
    );
  }
  const latest = knowledge.orders
    .slice(0, 3)
    .map((order) => `• #${order.code}: ${order.statusLabel} (đặt ${formatDate(order.createdAt)})`)
    .join('\n');
  return reply(`Các đơn gần nhất của bạn:\n${latest}\nBạn muốn xem chi tiết đơn nào?`);
}

function answerProduct(text: string, knowledge: BotKnowledge): BotReply {
  const attribute = ATTRIBUTE_WORDS.find((word) => text.includes(word));
  const tokens = text
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  const scored = knowledge.products
    .map((product) => {
      const haystack = normalize(`${product.name} ${product.attribute} ${product.series}`);
      const score = tokens.filter((token) => haystack.includes(token)).length;
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.product.stock - a.product.stock)
    .slice(0, 3);

  if (scored.length > 0) {
    return reply(scored.map((entry) => `• ${describeProduct(entry.product)}`).join('\n'));
  }
  if (attribute) {
    const inStock = knowledge.products
      .filter((product) => normalize(product.attribute) === attribute && product.stock > 0)
      .slice(0, 3);
    if (inStock.length > 0) {
      return reply(
        `Một vài mẫu hệ ${inStock[0]!.attribute} đang còn hàng:\n${inStock
          .map((product) => `• ${describeProduct(product)}`)
          .join('\n')}`,
      );
    }
  }
  return reply('Bạn cho mình tên mẫu hoặc hệ (Pyrus, Aquos, Darkus…) để mình kiểm tra hàng nhé.');
}

export function answerWithRules(
  message: string,
  topics: readonly BotTopicId[],
  knowledge: BotKnowledge,
): BotReply {
  const text = normalize(message);
  const enabled = new Set(topics);

  if (HANDOFF_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return reply('Việc này cần nhân viên TD Bakugan xác nhận, mình chuyển ngay cho bạn nhé.', true);
  }

  const topic = detectTopic(text);
  if (!topic) {
    if (/\b(cam on|thank)/.test(text)) {
      return reply('Dạ không có gì ạ! Cần gì thêm bạn cứ nhắn mình nha.');
    }
    if (/\b(chao|hello|hi|alo|shop oi)\b/.test(text) && text.length < 30) {
      return reply(
        'Chào bạn! Bạn cần mình hỗ trợ đơn hàng, phí ship hay thông tin sản phẩm nào ạ?',
      );
    }
    return reply('Câu này mình chưa chắc trả lời đúng, mình chuyển cho nhân viên nhé.', true);
  }

  if (!enabled.has(topic)) {
    return reply('Câu này cần nhân viên hỗ trợ trực tiếp, mình chuyển ngay nhé.', true);
  }

  switch (topic) {
    case 'order-status':
      return answerOrder(text, knowledge);
    case 'shipping':
      return reply(SHIPPING_POLICY.slice(0, 2).join(' '));
    case 'payment':
      return reply(PAYMENT_POLICY.join(' '));
    case 'returns':
      return reply(
        `${RETURN_POLICY[0]} ${RETURN_POLICY[2]} Nếu cần đổi trả đơn cụ thể, bạn bấm "Gặp nhân viên" nhé.`,
      );
    case 'auction-rules':
      return reply(
        'Phiên có luật chống bắn tỉa: lượt đặt trong 5 phút cuối sẽ đẩy giờ kết thúc thêm 5 phút, nên không ai thắng nhờ bấm giây chót. Ở phiên kín, giá hiện tại được giấu — bạn chỉ biết mình đang dẫn đầu hay bị vượt. Người thắng thanh toán trong 48 giờ.',
      );
    case 'promotions':
      return reply(
        knowledge.coupons.length > 0
          ? `Mã đang có:\n${knowledge.coupons.map((coupon) => `• ${coupon.code}: ${coupon.label}`).join('\n')}`
          : 'Hiện shop chưa có mã giảm giá nào đang chạy ạ.',
      );
    case 'store-info':
      return reply(
        `Shop ở ${SHOP_INFO.address}, mở cửa ${SHOP_INFO.workingHours}. Hotline/Zalo ${SHOP_INFO.hotline}.`,
      );
    case 'product-info':
      return answerProduct(text, knowledge);
    default:
      return reply('Câu này mình chưa chắc trả lời đúng, mình chuyển cho nhân viên nhé.', true);
  }
}

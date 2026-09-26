import type { BotReply, BotTopicId } from '@/types';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES } from '@/types';
import { SHOP_INFO } from '@/constants/routes';
import { ATTRIBUTE_META, SERIES_META } from '@/constants/catalog';
import { formatDate } from '@/utils/format';
import {
  ACCOUNT_GUIDE,
  BAKUGAN_BASICS,
  PAYMENT_POLICY,
  RETURN_POLICY,
  SHIPPING_POLICY,
  SHOP_COMMITMENTS,
  deliveryHint,
  describeAttributes,
  describeOrder,
  describeProduct,
  describeSeries,
  type BotKnowledge,
  type BotProductFact,
} from './botKnowledge';
import {
  extractBudget,
  extractOrderCode,
  hasAnyPhrase,
  hasPhrase,
  normalizeText,
} from './textNormalize';

/* ============================================================
   Bộ trả lời dự phòng — chạy khi chưa có khoá Gemini, khi hết hạn
   mức miễn phí hoặc khi mất mạng.

   Cách làm: chấm điểm từng "ý định" theo các cụm từ khách dùng (cụm
   càng dài càng chắc chắn), cộng thêm điểm khi nhắc tới tên mẫu, hệ,
   dòng sản phẩm. Không hiểu thì hỏi lại kèm gợi ý thay vì chuyển
   nhân viên ngay; khách hỏi lại vẫn không hiểu mới chuyển.
   Luôn tôn trọng danh sách việc admin cho phép.
   ============================================================ */

type IntentId =
  | 'human'
  | 'sensitive'
  | 'cancel'
  | 'buy'
  | 'order-status'
  | 'auction-rules'
  | 'promotions'
  | 'shipping'
  | 'payment'
  | 'returns'
  | 'product-info'
  | 'restock'
  | 'bakugan-knowledge'
  | 'authenticity'
  | 'account'
  | 'store-info'
  | 'capabilities'
  | 'greeting'
  | 'thanks'
  | 'bye';

interface IntentDef {
  id: IntentId;
  /** Việc admin phải cho phép thì bot mới tự trả lời */
  topic?: BotTopicId;
  phrases: readonly string[];
  /** Từ đơn nhưng rất rõ nghĩa (COD, MoMo…), tính 2 điểm */
  strong?: readonly string[];
  /** Từ chung chung, chỉ cộng nửa điểm */
  weak?: readonly string[];
}

/** Câu hỏi "… là gì": chỉ là kiến thức Bakugan khi hỏi về hệ, dòng hoặc chính Bakugan. */
const WHAT_IS = ['la gi', 'nghia la', 'la sao', 'khac gi'];

/** Thứ tự cũng là thứ tự ưu tiên khi hai ý định bằng điểm. */
const INTENTS: readonly IntentDef[] = [
  {
    id: 'human',
    phrases: [
      'nhan vien',
      'nguoi that',
      'gap admin',
      'gap shop',
      'chu shop',
      'tu van vien',
      'gap nguoi',
      'noi chuyen voi nguoi',
      'goi lai cho minh',
      'goi dien cho minh',
    ],
  },
  {
    id: 'sensitive',
    phrases: [
      'khieu nai',
      'hoan tien',
      'tra lai tien',
      'lay lai tien',
      'boi thuong',
      'giu hang',
      'giu giup',
      'giu dum',
      'giu lai',
      'de danh',
      'giu cho minh',
      'thu mua',
      'ban lai',
      'ky gui',
      'tra gop',
      'bot gia',
      'giam them',
      'chiet khau',
      'tra gia',
      'lua dao',
      'bi lua',
      'da chuyen khoan',
      'chuyen khoan roi',
      'chua nhan duoc tien',
      'giao nham',
      'giao sai',
      'sai hang',
      'thieu hang',
      'hang bi hong',
      'bi vo',
      'bi mop',
      'khong nhan duoc hang',
      'that lac',
      'doi dia chi',
      'sua don',
      'doi don',
      'them mon',
    ],
  },
  {
    id: 'cancel',
    topic: 'order-cancel',
    phrases: [
      'huy don',
      'huy dat hang',
      'huy don hang',
      'muon huy',
      'huy giup',
      'khong mua nua',
      'bo don',
      'khong lay nua',
    ],
  },
  {
    id: 'buy',
    phrases: [
      'muon mua',
      'can mua',
      'dat hang',
      'dat mua',
      'chot don',
      'lay con',
      'lay mau',
      'cho minh lay',
      'cho minh mua',
      'mua o dau',
      'cach mua',
      'len don',
      'mua nhu the nao',
      'mua sao',
    ],
    weak: ['mua'],
  },
  {
    id: 'order-status',
    topic: 'order-status',
    phrases: [
      'don hang',
      'don cua',
      'ma don',
      'toi dau',
      'giao chua',
      'van don',
      'kiem tra don',
      'tinh trang don',
      'tra cuu',
      'don minh',
      'don toi',
      'don em',
      'don cua minh',
      'bao gio nhan',
      'khi nao nhan',
      'khi nao toi',
      'bao gio toi',
      'da gui chua',
      'gui chua',
      'ship chua',
      'hang toi dau',
      'don dau',
      'nhan duoc hang chua',
      'khi nao giao',
      'bao gio giao',
    ],
    weak: ['bao gio', 'khi nao'],
  },
  {
    id: 'auction-rules',
    topic: 'auction-rules',
    phrases: [
      'dau gia',
      'ban tia',
      'gia han',
      'phien kin',
      'dat gia',
      'buoc gia',
      'cong them gio',
      'thang dau gia',
      'tham gia dau gia',
      'chot phien',
      'tu gia han',
      'phien dau gia',
    ],
    strong: ['sniper', 'bid'],
    weak: ['phien'],
  },
  {
    id: 'promotions',
    topic: 'promotions',
    phrases: [
      'ma giam',
      'ma giam gia',
      'khuyen mai',
      'uu dai',
      'giam gia',
      'code giam',
      'ma code',
      'dang giam',
    ],
    strong: ['freeship', 'voucher', 'coupon', 'sale'],
  },
  {
    id: 'shipping',
    topic: 'shipping',
    phrases: [
      'ship',
      'shipper',
      'giao hang',
      'van chuyen',
      'bao lau',
      'may ngay',
      'phi giao',
      'phi van chuyen',
      'phi ship',
      'tien ship',
      'gui hang',
      'ngoai tinh',
      'toan quoc',
      'tan noi',
      'dong goi',
      'dong kiem',
      'kiem hang',
      'mien phi van chuyen',
      'giao nhanh',
      'hoa toc',
      'giao tinh',
      'giao ra',
      'giao ve',
      'ship ra',
      'ship ve',
      'ship di',
      'nhan hang',
      'nhan duoc hang',
      'ha noi',
      'da nang',
      'tinh khac',
      'mien bac',
      'mien trung',
      'mien tay',
      'o xa',
      'duoc kiem tra',
    ],
  },
  {
    id: 'payment',
    topic: 'payment',
    phrases: [
      'thanh toan',
      'chuyen khoan',
      'tra tien',
      'quet ma',
      'the tin dung',
      'vi dien tu',
      'so tai khoan',
      'tien mat',
      'tra truoc',
      'nhan hang moi tra',
    ],
    strong: ['cod', 'momo', 'qr', 'visa', 'atm', 'zalopay', 'vnpay'],
  },
  {
    id: 'returns',
    topic: 'returns',
    phrases: [
      'doi tra',
      'doi hang',
      'tra hang',
      'bao hanh',
      'bi loi',
      'hu hong',
      'mat tu',
      'doi mau khac',
      'doi sang',
      'tra lai hang',
      'khong vua y',
      'loi nha san xuat',
      'nam cham yeu',
    ],
    weak: ['loi', 'hong'],
  },
  {
    id: 'product-info',
    topic: 'product-info',
    phrases: [
      'con hang',
      'het hang',
      'gia bao nhieu',
      'bao nhieu tien',
      'nhieu tien',
      'g power',
      'mau nao',
      'con nao',
      'tu van',
      'goi y',
      'manh nhat',
      're nhat',
      'dat nhat',
      'mac nhat',
      'hang hiem',
      'moi ve',
      'hang moi',
      'ban chay',
      'nguyen seal',
      'like new',
      'san pham',
      'dang ban',
      'co ban',
      'mau moi',
      'suu tam',
      'hot nhat',
      'noi bat',
    ],
    weak: ['gia', 'bao nhieu', 'co khong', 'con khong', 'mau', 'con', 'hot'],
  },
  {
    id: 'restock',
    topic: 'product-info',
    phrases: [
      'co hang lai',
      've hang',
      'hang ve',
      'nhap them',
      'khi nao co hang',
      'bao gio co hang',
      'dat hang truoc',
      'dat truoc',
      'pre order',
      'bao khi co hang',
    ],
  },
  {
    id: 'bakugan-knowledge',
    topic: 'bakugan-knowledge',
    phrases: [
      'bakugan la',
      'cach choi',
      'choi nhu the nao',
      'choi the nao',
      'luat choi',
      'g power la',
      'the gate',
      'the bai',
      'thuoc tinh',
      'attribute',
      'series',
      'dong nao',
      'the he',
      'nam cham',
      'bung ra',
      'phan biet',
      'y nghia',
      'cac he',
      'may he',
      'bao nhieu he',
      'khac nhau',
    ],
    weak: WHAT_IS,
  },
  {
    id: 'authenticity',
    topic: 'store-info',
    phrases: [
      'chinh hang',
      'hang that',
      'hang gia',
      'hang nhai',
      'uy tin',
      'tin tuong',
      'co that khong',
      'nguon hang',
      'nhap tu dau',
      'xuat xu',
      'hang xin',
    ],
    strong: ['fake', 'real', 'auth'],
  },
  {
    id: 'account',
    topic: 'store-info',
    phrases: [
      'dang ky',
      'tao tai khoan',
      'dang nhap',
      'quen mat khau',
      'doi mat khau',
      'tai khoan',
      'mat khau',
      'dang xuat',
    ],
  },
  {
    id: 'store-info',
    topic: 'store-info',
    phrases: [
      'dia chi',
      'o dau',
      'cua hang',
      'gio mo',
      'may gio',
      'mo cua',
      'dong cua',
      'hotline',
      'so dien thoai',
      'dien thoai',
      'zalo',
      'lien he',
      'facebook',
      'fanpage',
      'den xem',
      'ghe shop',
      'toi shop',
      'xem truc tiep',
      'offline',
      'email',
      'shop o',
      'chi nhanh',
      'gio lam viec',
      'lam viec',
    ],
  },
  {
    id: 'capabilities',
    phrases: [
      'lam duoc gi',
      'giup duoc gi',
      'giup gi',
      'ho tro gi',
      'hoi duoc gi',
      'ban la ai',
      'la bot',
      'la ai',
      'chuc nang',
      'ban biet gi',
    ],
  },
  {
    id: 'greeting',
    phrases: [
      'chao',
      'xin chao',
      'hello',
      'helo',
      'hi',
      'alo',
      'shop oi',
      'admin oi',
      'hey',
      'co ai khong',
      'chao shop',
    ],
  },
  {
    id: 'thanks',
    phrases: ['cam on', 'thank you', 'ok cam on', 'ok', 'vang', 'da vang', 'duoc roi', 'hieu roi'],
  },
  { id: 'bye', phrases: ['tam biet', 'bye', 'hen gap lai'] },
];

/** Từ tiếng Việt không dấu hay nằm sau tên chiến binh trong tên sản phẩm. */
const NAME_STOP_WORDS = new Set(['song', 'long', 'tam', 'kim', 'xanh', 'tay', 'sinh', 'bakugan']);

const ATTRIBUTE_PHRASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['pyrus', ['pyrus', 'he lua']],
  ['aquos', ['aquos', 'he nuoc']],
  ['subterra', ['subterra', 'he dat']],
  ['haos', ['haos', 'he anh sang']],
  ['darkus', ['darkus', 'he bong toi']],
  ['ventus', ['ventus', 'he gio']],
];

const SERIES_PHRASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['battle-brawlers', ['battle brawlers', 'brawlers']],
  ['new-vestroia', ['new vestroia', 'vestroia']],
  ['gundalian-invaders', ['gundalian invaders', 'gundalian']],
  ['mechtanium-surge', ['mechtanium surge', 'mechtanium']],
  ['battle-planet', ['battle planet']],
  ['geogan-rising', ['geogan rising', 'geogan']],
];

export const CLARIFY_PREFIX = 'Mình chưa hiểu rõ ý bạn';

/* ---------------- Nhận diện ---------------- */

function wordCount(phrase: string): number {
  return phrase.split(' ').length;
}

/** Tên chiến binh ở đầu tên sản phẩm: "Neo Dragonoid Bão Lửa" -> ["neo", "dragonoid"] */
function speciesTokens(productName: string): string[] {
  const words = productName.replace(/^Bakugan\s+/i, '').split(/\s+/);
  const tokens: string[] = [];
  for (const word of words) {
    const plain = normalizeText(word);
    // Từ có dấu tiếng Việt, hoặc từ tiếng Việt không dấu quen thuộc -> hết phần tên riêng.
    if (plain !== word.toLowerCase() || NAME_STOP_WORDS.has(plain) || plain.length < 3) break;
    tokens.push(plain);
  }
  return tokens;
}

interface ProductEntities {
  products: BotProductFact[];
  attributes: string[];
  series: string[];
}

function detectEntities(text: string, knowledge: BotKnowledge): ProductEntities {
  const words = text.split(' ').filter((word) => word.length >= 4);
  const products = knowledge.products.filter((product) =>
    speciesTokens(product.name).some(
      (token) =>
        token.length >= 4 && words.some((word) => token.startsWith(word) || word.startsWith(token)),
    ),
  );

  // Có nhiều mẫu trùng tên chiến binh ("Dragonoid") -> ưu tiên mẫu có thêm mô tả khớp.
  const described = products.filter((product) => {
    const extra = normalizeText(product.name)
      .split(' ')
      .filter((word) => word.length >= 3 && !speciesTokens(product.name).includes(word));
    return extra.some((word, index) => {
      const next = extra[index + 1];
      return next ? hasPhrase(text, `${word} ${next}`) : false;
    });
  });

  return {
    products: described.length > 0 ? described : products,
    attributes: ATTRIBUTE_PHRASES.filter(([, phrases]) => hasAnyPhrase(text, phrases)).map(
      ([id]) => id,
    ),
    series: SERIES_PHRASES.filter(([, phrases]) => hasAnyPhrase(text, phrases)).map(([id]) => id),
  };
}

function scoreIntents(text: string, entities: ProductEntities, hasOrderCode: boolean) {
  const scores = INTENTS.map((intent) => {
    let score = 0;
    intent.phrases.forEach((phrase) => {
      if (hasPhrase(text, phrase)) score += wordCount(phrase);
    });
    intent.strong?.forEach((phrase) => {
      if (hasPhrase(text, phrase)) score += 2;
    });
    intent.weak?.forEach((phrase) => {
      if (hasPhrase(text, phrase)) score += 0.5;
    });
    if (intent.id === 'order-status' && hasOrderCode) score += 3;
    const namesGroup = entities.attributes.length > 0 || entities.series.length > 0;
    if (intent.id === 'product-info') {
      if (entities.products.length > 0) score += 3;
      if (namesGroup) score += 1.5;
    }
    // "Pyrus là gì", "Battle Planet là gì" -> giải thích, không liệt kê hàng.
    if (intent.id === 'bakugan-knowledge' && namesGroup && hasAnyPhrase(text, WHAT_IS)) score += 2;
    return { intent, score };
  });
  return scores.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
}

/* ---------------- Câu trả lời từng loại ---------------- */

function reply(text: string, handoff = false): BotReply {
  return { reply: text, handoff, source: 'rules' };
}

const CAPABILITY_LABELS: Partial<Record<BotTopicId, string>> = {
  'order-status': 'tra cứu đơn hàng',
  'order-cancel': 'huỷ đơn còn chờ xác nhận',
  'product-info': 'tư vấn mẫu, giá, còn hàng',
  shipping: 'phí và thời gian giao hàng',
  payment: 'cách thanh toán',
  returns: 'chính sách đổi trả, bảo hành',
  'auction-rules': 'luật đấu giá',
  promotions: 'mã giảm giá đang có',
  'bakugan-knowledge': 'giải thích hệ, dòng, G-Power, cách chơi',
  'store-info': 'địa chỉ, giờ mở cửa',
};

function capabilityList(topics: ReadonlySet<BotTopicId>): string {
  return Object.entries(CAPABILITY_LABELS)
    .filter(([topic]) => topics.has(topic as BotTopicId))
    .map(([, label]) => `• ${label}`)
    .join('\n');
}

const SENSITIVE_REPLIES: ReadonlyArray<readonly [readonly string[], string]> = [
  [
    ['giu hang', 'giu giup', 'giu dum', 'giu lai', 'de danh', 'giu cho minh'],
    'Việc giữ hàng cần nhân viên TD Bakugan xác nhận, mình chuyển cho nhân viên ngay nhé.',
  ],
  [
    ['hoan tien', 'tra lai tien', 'lay lai tien'],
    'Yêu cầu hoàn tiền cần nhân viên kiểm tra đơn trước, mình chuyển cho nhân viên ngay nhé.',
  ],
  [
    ['khieu nai', 'boi thuong', 'bi lua', 'lua dao'],
    'Shop rất tiếc về chuyện này. Mình chuyển ngay cho nhân viên để xử lý cho bạn nhé.',
  ],
  [
    ['thu mua', 'ban lai', 'ky gui'],
    'Thu mua / ký gửi cần nhân viên định giá trực tiếp, mình chuyển cho nhân viên nhé.',
  ],
  [
    ['tra gop', 'bot gia', 'giam them', 'chiet khau', 'tra gia'],
    'Giá và ưu đãi riêng cần nhân viên xác nhận, mình chuyển cho nhân viên ngay nhé.',
  ],
  [
    ['da chuyen khoan', 'chuyen khoan roi', 'chua nhan duoc tien'],
    'Mình chuyển cho nhân viên kiểm tra giao dịch chuyển khoản của bạn ngay nhé.',
  ],
  [
    ['doi dia chi', 'sua don', 'doi don', 'them mon'],
    'Việc sửa đơn cần nhân viên cập nhật, mình chuyển cho nhân viên ngay nhé.',
  ],
];

function answerSensitive(text: string, entities: ProductEntities): BotReply {
  const match = SENSITIVE_REPLIES.find(([phrases]) => hasAnyPhrase(text, phrases));
  const product = entities.products[0];
  const info = product ? `\n(${describeProduct(product)})` : '';
  return reply(
    `${
      match?.[1] ??
      'Shop xin lỗi vì sự cố. Mình chuyển nhân viên kiểm tra cho bạn ngay; bạn chuẩn bị giúp ảnh hoặc video mở hộp nếu có nhé.'
    }${info}`,
    true,
  );
}

function activeOrders(knowledge: BotKnowledge) {
  return knowledge.orders.filter((order) =>
    ['pending', 'confirmed', 'packing', 'shipping'].includes(order.status),
  );
}

function answerOrder(text: string, knowledge: BotKnowledge): BotReply {
  if (!knowledge.isSignedIn) {
    return reply(
      'Để bảo mật, mình chỉ tra được đơn khi bạn đăng nhập đúng tài khoản đã đặt hàng. Bạn đăng nhập rồi hỏi lại giúp mình nhé — hoặc bấm "Gặp nhân viên" nếu bạn đặt không qua tài khoản.',
    );
  }
  const code = extractOrderCode(text);
  if (code) {
    const order = knowledge.orders.find((item) => item.code.toUpperCase() === code);
    return order
      ? reply(describeOrder(order))
      : reply(
          `Mình không thấy đơn #${code} trong tài khoản của bạn. Bạn kiểm tra lại mã đơn (trong mục "Đơn hàng của tôi") giúp mình nhé.`,
        );
  }
  if (knowledge.orders.length === 0) {
    return reply('Tài khoản của bạn chưa có đơn hàng nào ạ.');
  }
  const active = activeOrders(knowledge);
  if (active.length === 1) return reply(describeOrder(active[0]!));
  if (active.length > 1) {
    const list = active
      .map((order) => `• #${order.code}: ${order.statusLabel}. ${deliveryHint(order.status)}`)
      .join('\n');
    return reply(`Các đơn đang xử lý của bạn:\n${list}`);
  }
  const recent = knowledge.orders
    .slice(0, 3)
    .map((order) => `• #${order.code}: ${order.statusLabel} (đặt ${formatDate(order.createdAt)})`)
    .join('\n');
  return reply(
    `Bạn không có đơn nào đang xử lý. Các đơn gần nhất:\n${recent}\nBạn gửi mã đơn nếu muốn xem chi tiết nhé.`,
  );
}

type ProductSort = 'popular' | 'cheap' | 'expensive' | 'strong' | 'newest';

function pickProducts(text: string, entities: ProductEntities, knowledge: BotKnowledge) {
  let pool = knowledge.products;
  let filtered = false;
  const narrow = (keep: (product: BotProductFact) => boolean) => {
    pool = pool.filter(keep);
    filtered = true;
  };
  if (entities.products.length > 0) pool = entities.products;
  if (entities.attributes.length > 0) {
    narrow((product) => entities.attributes.includes(product.attributeId));
  }
  if (entities.series.length > 0) narrow((product) => entities.series.includes(product.seriesId));
  if (hasAnyPhrase(text, ['hang hiem', 'hiem'])) narrow((product) => product.isRare);
  const wantsNew = hasAnyPhrase(text, ['moi ve', 'hang moi', 'mau moi']);
  if (wantsNew) narrow((product) => product.isNew);
  if (hasAnyPhrase(text, ['giam gia', 'sale', 'dang giam'])) {
    narrow((product) => Boolean(product.originalPrice));
  }
  const budget = extractBudget(text);
  if (budget) narrow((product) => product.price >= budget.min && product.price <= budget.max);

  let sort: ProductSort = 'popular';
  if (hasAnyPhrase(text, ['re nhat', 'gia re'])) sort = 'cheap';
  else if (hasAnyPhrase(text, ['dat nhat', 'mac nhat', 'cao cap'])) sort = 'expensive';
  else if (hasAnyPhrase(text, ['manh nhat', 'g power cao', 'manh'])) sort = 'strong';
  else if (wantsNew) sort = 'newest';

  const inStockFirst = (a: BotProductFact, b: BotProductFact) =>
    Number(b.stock > 0) - Number(a.stock > 0);
  const compare: Record<ProductSort, (a: BotProductFact, b: BotProductFact) => number> = {
    cheap: (a, b) => inStockFirst(a, b) || a.price - b.price,
    expensive: (a, b) => inStockFirst(a, b) || b.price - a.price,
    strong: (a, b) => inStockFirst(a, b) || b.gPower - a.gPower,
    newest: (a, b) => inStockFirst(a, b) || a.ageDays - b.ageDays,
    popular: (a, b) => inStockFirst(a, b) || b.soldCount - a.soldCount,
  };
  return { items: [...pool].sort(compare[sort]), sort, filtered };
}

const SORT_HEADINGS: Record<Exclude<ProductSort, 'popular'>, string> = {
  cheap: 'Mẫu giá mềm nhất',
  expensive: 'Mẫu cao cấp nhất',
  strong: 'Mẫu có G-Power cao nhất',
  newest: 'Mẫu mới lên kệ gần đây',
};

function listProducts(products: readonly BotProductFact[]): string {
  return products.map((product) => `• ${describeProduct(product)}`).join('\n');
}

function answerProduct(text: string, entities: ProductEntities, knowledge: BotKnowledge): BotReply {
  const { items: matches, sort, filtered } = pickProducts(text, entities, knowledge);
  const named = entities.products.length > 0;

  if (named && matches.length > 0 && matches.every((product) => product.stock === 0)) {
    const attribute = matches[0]!.attributeId;
    const similar = knowledge.products
      .filter((product) => product.attributeId === attribute && product.stock > 0)
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 2);
    return reply(
      `${listProducts(matches.slice(0, 2))}\nMẫu này hiện đang hết hàng.${
        similar.length > 0
          ? ` Cùng hệ ${similar[0]!.attribute} đang có:\n${listProducts(similar)}`
          : ''
      }`,
    );
  }

  if (matches.length > 0) {
    const shown = matches.slice(0, 3);
    const inStock = matches.filter((product) => product.stock > 0).length;
    let heading = '';
    if (!named) {
      if (sort !== 'popular') heading = `${SORT_HEADINGS[sort]}:\n`;
      else if (filtered) heading = `Có ${matches.length} mẫu phù hợp, bán chạy nhất:\n`;
      else heading = `Shop đang có ${inStock} mẫu còn hàng. Bán chạy nhất:\n`;
    }
    const more =
      matches.length > shown.length
        ? `\nCòn ${matches.length - shown.length} mẫu khác, bạn xem ở mục Sản phẩm hoặc cho mình biết hệ / tầm giá để lọc thêm nhé.`
        : '';
    return reply(`${heading}${listProducts(shown)}${more}`);
  }

  if (named || filtered) {
    return reply(
      'Hiện shop chưa có mẫu đúng như bạn tìm. Bạn thử hệ hoặc tầm giá khác, hoặc bấm "Gặp nhân viên" để shop tìm hàng giúp nhé.',
    );
  }
  return reply(
    'Hiện shop tạm hết hàng. Bạn bấm "Gặp nhân viên" để được báo ngay khi có lô mới nhé.',
  );
}

function answerBuy(
  text: string,
  entities: ProductEntities,
  knowledge: BotKnowledge,
  confident: boolean,
): BotReply {
  const matches = entities.products.length > 0 ? pickProducts(text, entities, knowledge).items : [];
  const info = matches.length > 0 ? `${listProducts(matches.slice(0, 2))}\n` : '';
  return reply(
    `${info}Bạn gửi giúp mình tên mẫu, số lượng và địa chỉ nhận hàng nhé — nhân viên sẽ xác nhận còn hàng, báo tổng tiền và cách thanh toán rồi lên đơn cho bạn ngay. Shop giao toàn quốc.`,
    confident,
  );
}

function answerRestock(entities: ProductEntities, knowledge: BotKnowledge): BotReply {
  const inStock = entities.products.filter((product) => product.stock > 0);
  if (inStock.length > 0) {
    return reply(
      `Mẫu này đang có hàng ạ:\n${inStock
        .slice(0, 2)
        .map((product) => `• ${describeProduct(product)}`)
        .join('\n')}`,
    );
  }
  const name = entities.products[0]?.name;
  const similar = entities.products[0]
    ? knowledge.products
        .filter(
          (product) =>
            product.attributeId === entities.products[0]!.attributeId && product.stock > 0,
        )
        .slice(0, 2)
    : [];
  return reply(
    `Shop nhập hàng theo từng lô nên chưa có lịch cố định. Mình chuyển nhân viên để báo bạn ngay khi có ${name ?? 'mẫu bạn cần'} nhé.${
      similar.length > 0
        ? `\nTrong lúc chờ, cùng hệ đang có:\n${similar.map((product) => `• ${describeProduct(product)}`).join('\n')}`
        : ''
    }`,
    true,
  );
}

function answerShipping(text: string, knowledge: BotKnowledge): BotReply {
  const wantsFee = hasAnyPhrase(text, ['phi', 'bao nhieu', 'tien ship', 'mien phi', 'freeship']);
  const wantsTime = hasAnyPhrase(text, [
    'bao lau',
    'may ngay',
    'khi nao',
    'bao gio',
    'nhanh',
    'nhan hang',
    'nhan duoc hang',
  ]);
  const packaging = hasAnyPhrase(text, ['dong goi', 'boc', 'hop']);
  const inspection = hasAnyPhrase(text, [
    'dong kiem',
    'kiem hang',
    'xem hang',
    'kiem tra',
    'duoc kiem tra',
    'mo hop',
  ]);
  const remote = hasAnyPhrase(text, [
    'ha noi',
    'da nang',
    'tinh khac',
    'ngoai tinh',
    'mien bac',
    'mien trung',
    'mien tay',
    'o xa',
    'toan quoc',
  ]);
  const specific = wantsFee || wantsTime || packaging || inspection;
  const lines: string[] = [];
  if (remote) lines.push('Shop giao toàn quốc ạ.');
  if (wantsFee || !specific) lines.push(SHIPPING_POLICY[0]!);
  if (wantsTime || !specific) lines.push(SHIPPING_POLICY[1]!);
  if (packaging) lines.push(SHIPPING_POLICY[2]!);
  if (inspection) lines.push(SHIPPING_POLICY[3]!);

  // Khách đã đăng nhập và có đơn đang giao -> báo luôn đơn của họ.
  const shipping = activeOrders(knowledge).find((order) => order.status === 'shipping');
  if (wantsTime && shipping) {
    lines.push(`Đơn #${shipping.code} của bạn đang được giao.`);
  }
  return reply(lines.join(' '));
}

function answerPayment(text: string): BotReply {
  const lines = [PAYMENT_POLICY[0]!, PAYMENT_POLICY[1]!];
  if (hasAnyPhrase(text, ['dau gia', 'thang'])) lines.push(PAYMENT_POLICY[2]!);
  if (hasAnyPhrase(text, ['so tai khoan', 'chuyen khoan', 'qr', 'quet ma'])) {
    lines.push('Khi chốt đơn, nhân viên sẽ gửi thông tin chuyển khoản cho bạn.');
  }
  return reply(lines.join(' '));
}

function answerReturns(text: string): BotReply {
  const lines = [RETURN_POLICY[0]!];
  if (hasAnyPhrase(text, ['dau gia', 'da dung', 'qua 7 ngay', 'qua han'])) {
    lines.push(RETURN_POLICY[1]!);
  }
  lines.push(RETURN_POLICY[2]!);
  lines.push('Cần đổi trả một đơn cụ thể thì bạn bấm "Gặp nhân viên" kèm ảnh/video sản phẩm nhé.');
  return reply(lines.join(' '));
}

function answerAuction(text: string): BotReply {
  const parts: string[] = [];
  if (hasAnyPhrase(text, ['phien kin', 'an gia', 'giau gia'])) {
    parts.push(
      'Ở phiên kín, giá hiện tại và số tiền trong lịch sử đều được giấu: bạn chỉ biết mình đang dẫn đầu hay đã bị vượt, nên hãy đặt đúng mức bạn thấy xứng đáng.',
    );
  }
  if (hasAnyPhrase(text, ['ban tia', 'gia han', 'cong them gio', 'tu gia han', 'sniper'])) {
    parts.push(
      'Luật chống bắn tỉa: lượt đặt nào rơi vào 5 phút cuối sẽ đẩy giờ kết thúc thêm 5 phút, nên không ai thắng nhờ bấm ở giây chót. Phiên chỉ đóng khi trọn 5 phút không còn ai đặt.',
    );
  }
  if (
    hasAnyPhrase(text, [
      'dat gia',
      'buoc gia',
      'tham gia',
      'cach',
      'nhu the nao',
      'the nao',
      'lam sao',
      'bid',
    ])
  ) {
    parts.push(
      'Cách tham gia: đăng nhập, vào mục Đấu giá, chọn phiên đang diễn ra và nhập mức giá từ giá hiện tại cộng bước giá trở lên. Lượt đặt là cam kết mua nên không huỷ được.',
    );
  }
  if (hasAnyPhrase(text, ['thang', 'thanh toan', 'nhan hang'])) {
    parts.push(
      'Người thắng được shop liên hệ trong 24 giờ và cần thanh toán trong 48 giờ; hàng đấu giá không áp dụng đổi trả.',
    );
  }
  if (parts.length === 0) {
    parts.push(
      'Đấu giá ở TD Bakugan có luật chống bắn tỉa (đặt trong 5 phút cuối thì phiên tự cộng thêm 5 phút) và phiên kín (giấu giá hiện tại). Bạn cần đăng nhập để đặt giá; người thắng thanh toán trong 48 giờ.',
    );
  }
  return reply(parts.join('\n'));
}

function answerPromotions(
  text: string,
  topics: ReadonlySet<BotTopicId>,
  knowledge: BotKnowledge,
): BotReply {
  const freeShip =
    hasAnyPhrase(text, ['freeship', 'mien phi van chuyen', 'mien phi ship']) &&
    topics.has('shipping')
      ? `${SHIPPING_POLICY[0]}\n`
      : '';
  const coupons =
    knowledge.coupons.length > 0
      ? `Mã đang có:\n${knowledge.coupons.map((coupon) => `• ${coupon.code}: ${coupon.label}`).join('\n')}`
      : 'Hiện shop chưa có mã giảm giá nào đang chạy ạ.';
  const onSale =
    topics.has('product-info') && !freeShip
      ? knowledge.products
          .filter((product) => product.originalPrice && product.stock > 0)
          .sort((a, b) => (b.originalPrice ?? 0) - b.price - ((a.originalPrice ?? 0) - a.price))
          .slice(0, 3)
      : [];
  return reply(
    `${freeShip}${coupons}${
      onSale.length > 0
        ? `\nMẫu đang giảm giá:\n${onSale.map((product) => `• ${describeProduct(product)}`).join('\n')}`
        : ''
    }`,
  );
}

function answerStore(text: string): BotReply {
  if (
    hasAnyPhrase(text, [
      'zalo',
      'facebook',
      'fanpage',
      'email',
      'hotline',
      'dien thoai',
      'so dien thoai',
      'lien he',
    ])
  ) {
    return reply(
      `Bạn liên hệ shop qua hotline/Zalo ${SHOP_INFO.hotline} hoặc email ${SHOP_INFO.email} nhé. Shop làm việc ${SHOP_INFO.workingHours}.`,
    );
  }
  return reply(
    `Shop ở ${SHOP_INFO.address}, mở cửa ${SHOP_INFO.workingHours}. Bạn ghé xem trực tiếp được; muốn chắc còn mẫu nào thì nhắn trước hoặc gọi hotline/Zalo ${SHOP_INFO.hotline} nhé.`,
  );
}

function answerKnowledge(text: string, entities: ProductEntities): BotReply {
  if (entities.attributes.length > 0 && !hasAnyPhrase(text, ['cac he', 'may he', 'bao nhieu he'])) {
    const meta = ATTRIBUTE_META[entities.attributes[0] as keyof typeof ATTRIBUTE_META];
    return reply(
      `${meta.label} là hệ ${meta.element} — ${meta.description.split('—')[1]?.trim() ?? ''}. Có 6 hệ: ${describeAttributes()}.`,
    );
  }
  if (entities.series.length > 0) {
    const meta = SERIES_META[entities.series[0] as keyof typeof SERIES_META];
    return reply(`${meta.label} (${meta.years}): ${meta.description}`);
  }
  if (
    hasAnyPhrase(text, [
      'cach choi',
      'choi nhu the nao',
      'choi the nao',
      'luat choi',
      'the gate',
      'the bai',
    ])
  ) {
    return reply(BAKUGAN_BASICS[1]!);
  }
  if (hasAnyPhrase(text, ['g power'])) return reply(BAKUGAN_BASICS[2]!);
  if (hasAnyPhrase(text, ['he', 'thuoc tinh', 'attribute', 'cac he', 'may he', 'bao nhieu he'])) {
    return reply(`Bakugan có 6 hệ: ${describeAttributes()}.`);
  }
  if (hasAnyPhrase(text, ['series', 'dong nao', 'the he', 'dong'])) {
    return reply(`Các dòng Bakugan shop đang bán: ${describeSeries()}.`);
  }
  return reply(
    `${BAKUGAN_BASICS[0]} Hiện có ${BAKUGAN_ATTRIBUTES.length} hệ và shop bán ${BAKUGAN_SERIES.length} dòng, từ Battle Brawlers đời đầu tới Geogan Rising.`,
  );
}

function answerCancelFallback(topics: ReadonlySet<BotTopicId>): BotReply {
  if (!topics.has('order-cancel')) {
    return reply('Việc huỷ đơn cần nhân viên xác nhận, mình chuyển cho nhân viên ngay nhé.', true);
  }
  return reply(
    'Bạn nhắn "huỷ đơn" kèm mã đơn (VD: huỷ đơn TD2609A17) nhé. Đơn còn chờ xác nhận và chưa thanh toán thì mình huỷ được ngay; đơn khác mình sẽ chuyển nhân viên.',
  );
}

/* ---------------- Điểm vào ---------------- */

export interface RuleBotContext {
  topics: readonly BotTopicId[];
  knowledge: BotKnowledge;
  /** Câu trả lời gần nhất của bot — để biết khách hỏi lại mà bot vẫn chưa hiểu */
  previousBotReply?: string;
}

/** Việc cần người thật: nhắc tới là ưu tiên chuyển nhân viên. */
const URGENT_INTENTS: ReadonlySet<IntentId> = new Set(['human', 'sensitive', 'cancel']);

/** Câu hỏi thông tin ngắn — khách hỏi hai ý trong một câu thì trả lời cả hai. */
const INFO_INTENTS: ReadonlySet<IntentId> = new Set([
  'shipping',
  'payment',
  'returns',
  'promotions',
  'store-info',
  'authenticity',
  'account',
  'auction-rules',
  'bakugan-knowledge',
]);

interface AnswerInput {
  text: string;
  topics: ReadonlySet<BotTopicId>;
  knowledge: BotKnowledge;
  entities: ProductEntities;
  score: number;
}

function answerIntent(id: IntentId, input: AnswerInput): BotReply {
  const { text, topics, knowledge, entities } = input;
  switch (id) {
    case 'human':
      return reply('Mình chuyển bạn sang nhân viên TD Bakugan ngay nhé.', true);
    case 'sensitive':
      return answerSensitive(text, entities);
    case 'cancel':
      return answerCancelFallback(topics);
    case 'buy':
      return answerBuy(text, entities, knowledge, input.score >= 2);
    case 'order-status':
      return answerOrder(text, knowledge);
    case 'auction-rules':
      return answerAuction(text);
    case 'promotions':
      return answerPromotions(text, topics, knowledge);
    case 'shipping':
      return answerShipping(text, knowledge);
    case 'payment':
      return answerPayment(text);
    case 'returns':
      return answerReturns(text);
    case 'product-info':
      return answerProduct(text, entities, knowledge);
    case 'restock':
      return answerRestock(entities, knowledge);
    case 'bakugan-knowledge':
      return answerKnowledge(text, entities);
    case 'authenticity':
      return reply(`${SHOP_COMMITMENTS[0]} ${SHOP_COMMITMENTS[1]}`);
    case 'account':
      return reply(ACCOUNT_GUIDE);
    case 'store-info':
      return answerStore(text);
    case 'capabilities':
      return reply(
        `Mình là trợ lý AI của TD Bakugan. Mình có thể giúp bạn:\n${capabilityList(topics)}\nViệc khác mình sẽ chuyển cho nhân viên.`,
      );
    case 'greeting':
      return reply(
        'Chào bạn! Mình là trợ lý AI của TD Bakugan. Bạn cần tra đơn, hỏi giá – còn hàng, phí ship hay luật đấu giá ạ?',
      );
    case 'thanks':
      return reply(
        hasAnyPhrase(text, ['cam on', 'thank you'])
          ? 'Dạ không có gì ạ! Cần gì thêm bạn cứ nhắn mình nha.'
          : 'Dạ vâng ạ. Cần gì thêm bạn cứ nhắn mình nha.',
      );
    case 'bye':
    default:
      return reply('Cảm ơn bạn đã ghé TD Bakugan, hẹn gặp lại nhé!');
  }
}

function isAllowed(intent: IntentDef, topics: ReadonlySet<BotTopicId>): boolean {
  return !intent.topic || topics.has(intent.topic);
}

export function answerWithRules(message: string, context: RuleBotContext): BotReply {
  const text = normalizeText(message);
  const topics = new Set(context.topics);
  const { knowledge } = context;
  const entities = detectEntities(text, knowledge);
  const ranked = scoreIntents(text, entities, Boolean(extractOrderCode(text)));

  // Lời chào / cảm ơn chỉ được tính khi câu không hỏi gì khác.
  const meaningful = ranked.filter(
    (entry) => !['greeting', 'thanks', 'bye'].includes(entry.intent.id) || ranked.length === 1,
  );
  let best = meaningful[0];
  const urgent = meaningful.find(
    (entry) => URGENT_INTENTS.has(entry.intent.id) && entry.score >= 2,
  );
  const buy = meaningful.find((entry) => entry.intent.id === 'buy');
  if (urgent) best = urgent;
  // "Muốn mua Dragonoid" -> ý định mua quan trọng hơn hỏi thông tin.
  else if (best?.intent.id === 'product-info' && buy && buy.score >= 2) best = buy;

  if (!best) {
    if (context.previousBotReply?.startsWith(CLARIFY_PREFIX)) {
      return reply('Để nhân viên TD Bakugan hỗ trợ bạn rõ hơn nhé, mình chuyển ngay đây.', true);
    }
    const hints = Object.entries(CAPABILITY_LABELS)
      .filter(([topic]) => topics.has(topic as BotTopicId))
      .map(([, label]) => label)
      .slice(0, 6)
      .join(', ');
    return reply(
      `${CLARIFY_PREFIX}. Mình có thể giúp ${hints}… Bạn hỏi lại cụ thể hơn giúp mình, hoặc bấm "Gặp nhân viên" nhé.`,
    );
  }

  const input: AnswerInput = { text, topics, knowledge, entities, score: best.score };
  if (!isAllowed(best.intent, topics)) {
    if (best.intent.id === 'cancel') return answerCancelFallback(topics);
    return reply(
      'Câu này nhân viên TD Bakugan sẽ hỗ trợ bạn trực tiếp, mình chuyển ngay nhé.',
      true,
    );
  }
  const primary = answerIntent(best.intent.id, input);

  // Hỏi hai ý thông tin trong một câu ("ship có COD không") -> trả lời cả hai.
  const second = meaningful.find(
    (entry) =>
      entry !== best &&
      INFO_INTENTS.has(entry.intent.id) &&
      isAllowed(entry.intent, topics) &&
      entry.score >= 1 &&
      entry.score >= best.score - 1,
  );
  if (second && INFO_INTENTS.has(best.intent.id) && !primary.handoff) {
    const extra = answerIntent(second.intent.id, { ...input, score: second.score });
    if (!extra.handoff) return reply(`${primary.reply}\n${extra.reply}`);
  }
  return primary;
}

/** Dùng trong kiểm thử và trang cài đặt: xem bot hiểu câu hỏi theo ý định nào. */
export function explainIntent(message: string, knowledge: BotKnowledge): string {
  const text = normalizeText(message);
  const ranked = scoreIntents(
    text,
    detectEntities(text, knowledge),
    Boolean(extractOrderCode(text)),
  );
  return ranked.map((entry) => `${entry.intent.id}:${entry.score}`).join(' ') || '(không rõ)';
}

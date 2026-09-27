import type { BotReply, BotTopicId, ChatLink } from '@/types';
import { BAKUGAN_ATTRIBUTES } from '@/types';
import { ROUTES, SHOP_INFO } from '@/constants/routes';
import { ATTRIBUTE_META, AUCTION_MIN_LEVEL, SERIES_META } from '@/constants/catalog';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { formatItemCode } from '@/utils/itemCode';
import {
  ACCOUNT_GUIDE,
  BAKUGAN_BASICS,
  cardPaymentLine,
  FEED_GUIDE,
  internationalShippingLine,
  ORDERING_GUIDE,
  PAYMENT_POLICY,
  RETURN_POLICY,
  SHIPPING_POLICY,
  SHOP_COMMITMENTS,
  deliveryHint,
  describeAttributes,
  describeFeed,
  describeItem,
  describeMembership,
  describeOrder,
  describeSeries,
  feedLink,
  itemLink,
  membershipRules,
  type BotItemFact,
  type BotKnowledge,
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
  | 'feeds'
  | 'membership'
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
      'nuoc ngoai',
      'ship quoc te',
      'gui quoc te',
      'giao quoc te',
      'ship qua',
      'gui qua',
      'ship sang',
      'gui sang',
      'viet kieu',
      'overseas',
      'international',
      'internationally',
      'abroad',
      'worldwide',
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
      'the ghi no',
      'the quoc te',
      'quet the',
      'tra bang the',
      'credit card',
      'debit card',
    ],
    strong: ['cod', 'momo', 'qr', 'visa', 'mastercard', 'jcb', 'atm', 'zalopay', 'vnpay'],
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
      'nguyen seal',
      'like new',
      'san pham',
      'dang ban',
      'co ban',
      'suu tam',
      'noi bat',
      'da ban chua',
      'ban chua',
      'con ban',
      'ma bk',
    ],
    strong: ['sold'],
    weak: ['gia', 'bao nhieu', 'co khong', 'con khong', 'mau', 'con', 'hot'],
  },
  {
    id: 'feeds',
    topic: 'product-info',
    phrases: [
      'feed moi',
      'feed sau',
      'feed tiep',
      'lo moi',
      'lo hang',
      'dot hang',
      'mo ban',
      'gio mo ban',
      'khi nao mo ban',
      'len feed',
      'dang feed',
      'bai dang',
      'hang moi',
      'moi ve',
      'hang ve',
      've hang',
      'co hang lai',
      'co hang moi',
      'nhap them',
      'khi nao co hang',
      'bao gio co hang',
      'dat hang truoc',
      'dat truoc',
      'pre order',
      'bao khi co hang',
    ],
    strong: ['feed'],
  },
  {
    id: 'membership',
    topic: 'membership',
    phrases: [
      'len lv2',
      'lv 2',
      'level 2',
      'len hang',
      'hang thanh vien',
      'thanh vien',
      'cap do',
      'len cap',
      'nap tien',
      'nap coc',
      'tien coc',
      'xet duyet',
      'duyet len',
      'khong dat gia duoc',
      'khong bid duoc',
      'khong tham gia duoc',
      'dieu kien dau gia',
      'du dieu kien',
      'nap bao nhieu',
    ],
    strong: ['lv2', 'lv1', 'level'],
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

/** Từ tiếng Việt không dấu hay nằm sau tên chiến binh trong tên Bakugan. */
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

/** Tên chiến binh ở đầu tên Bakugan: "Neo Dragonoid Bão Lửa" -> ["neo", "dragonoid"] */
function speciesTokens(itemName: string): string[] {
  const words = itemName.replace(/^Bakugan\s+/i, '').split(/\s+/);
  const tokens: string[] = [];
  for (const word of words) {
    const plain = normalizeText(word);
    // Từ có dấu tiếng Việt, hoặc từ tiếng Việt không dấu quen thuộc -> hết phần tên riêng.
    if (plain !== word.toLowerCase() || NAME_STOP_WORDS.has(plain) || plain.length < 3) break;
    tokens.push(plain);
  }
  return tokens;
}

interface ItemEntities {
  /** Con còn bán khớp tên chiến binh khách nhắc tới */
  items: BotItemFact[];
  /** Tên chiến binh khách nhắc tới theo thứ tự trong câu (kể cả khi không còn con nào) */
  species: string[];
  /** Mã BK khách gõ ("bk 231", "BK-0231") */
  codes: string[];
  attributes: string[];
  series: string[];
}

/** "bk 0231", "bk231" -> ["BK-0231"] */
function extractItemCodes(text: string): string[] {
  return [...text.matchAll(/\bbk ?(\d{1,4})\b/g)].map((match) => formatItemCode(Number(match[1])));
}

/** Tên chiến binh quen thuộc — nhận ra cả khi trên web không còn con nào tên đó. */
const KNOWN_SPECIES = [
  'dragonoid',
  'drago',
  'tigrerra',
  'gorem',
  'preyas',
  'skyress',
  'hydranoid',
  'percival',
  'nemus',
  'elfin',
  'wilda',
  'ingram',
  'helios',
  'linehalt',
  'fenneca',
  'sharpedoid',
];

/** "drago" khớp "dragonoid", "dragonoid" khớp "dragonoid". */
function sameName(token: string, word: string): boolean {
  return token.length >= 4 && (token.startsWith(word) || word.startsWith(token));
}

function detectEntities(text: string, knowledge: BotKnowledge): ItemEntities {
  const words = text.split(' ').filter((word) => word.length >= 4);
  const items = knowledge.items.filter((item) =>
    speciesTokens(item.name).some((token) => words.some((word) => sameName(token, word))),
  );

  // Có nhiều con trùng tên chiến binh ("Dragonoid") -> ưu tiên con có thêm mô tả khớp.
  const described = items.filter((item) => {
    const extra = normalizeText(item.name)
      .split(' ')
      .filter((word) => word.length >= 3 && !speciesTokens(item.name).includes(word));
    return extra.some((word, index) => {
      const next = extra[index + 1];
      return next ? hasPhrase(text, `${word} ${next}`) : false;
    });
  });

  // Gọi theo đúng tên khách nhắc tới ("Drago" -> "dragonoid", không phải "titanium").
  const species: string[] = [];
  for (const word of words) {
    const name =
      items.flatMap((item) => speciesTokens(item.name)).find((token) => sameName(token, word)) ??
      KNOWN_SPECIES.find((known) => sameName(known, word));
    if (name && !species.includes(name)) species.push(name);
  }

  return {
    items: described.length > 0 ? described : items,
    species,
    codes: extractItemCodes(text),
    attributes: ATTRIBUTE_PHRASES.filter(([, phrases]) => hasAnyPhrase(text, phrases)).map(
      ([id]) => id,
    ),
    series: SERIES_PHRASES.filter(([, phrases]) => hasAnyPhrase(text, phrases)).map(([id]) => id),
  };
}

function scoreIntents(text: string, entities: ItemEntities, hasOrderCode: boolean) {
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
    if (intent.id === 'feeds' && extractFeedNumber(text) !== undefined) score += 3;
    const namesGroup = entities.attributes.length > 0 || entities.series.length > 0;
    if (intent.id === 'product-info') {
      if (entities.items.length > 0 || entities.species.length > 0) score += 3;
      if (entities.codes.length > 0) score += 4;
      if (namesGroup) score += 1.5;
    }
    // "Pyrus là gì", "Battle Planet là gì" -> giải thích, không liệt kê hàng.
    if (intent.id === 'bakugan-knowledge' && namesGroup && hasAnyPhrase(text, WHAT_IS)) score += 2;
    return { intent, score };
  });
  return scores.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
}

/* ---------------- Câu trả lời từng loại ---------------- */

function reply(
  text: string,
  handoff = false,
  extra: Pick<BotReply, 'links' | 'quickReplies'> = {},
): BotReply {
  return {
    reply: text,
    handoff,
    source: 'rules',
    ...(extra.links?.length ? { links: extra.links.slice(0, 5) } : {}),
    ...(extra.quickReplies?.length ? { quickReplies: extra.quickReplies } : {}),
  };
}

const CAPABILITY_LABELS: Partial<Record<BotTopicId, string>> = {
  'product-info': 'tư vấn chọn Bakugan, feed nào đang / sắp mở bán, con nào còn',
  'order-status': 'tra cứu đơn hàng',
  'order-cancel': 'huỷ đơn còn chờ xác nhận',
  membership: 'cách lên Lv2 để đấu giá',
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
    'Mỗi con chỉ có một và ai chốt đơn trước được trước nên shop thường không giữ hàng; mình chuyển nhân viên xem giúp bạn nhé.',
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

function answerSensitive(text: string, entities: ItemEntities): BotReply {
  const match = SENSITIVE_REPLIES.find(([phrases]) => hasAnyPhrase(text, phrases));
  const item = entities.items[0];
  const info = item ? `\n(${describeItem(item)})` : '';
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

type ItemSort = 'featured' | 'hot' | 'cheap' | 'expensive' | 'strong' | 'newest';

function pickItems(text: string, entities: ItemEntities, knowledge: BotKnowledge) {
  let pool = knowledge.items;
  let filtered = false;
  const narrow = (keep: (item: BotItemFact) => boolean) => {
    pool = pool.filter(keep);
    filtered = true;
  };
  if (entities.items.length > 0 || entities.species.length > 0) pool = entities.items;
  if (entities.attributes.length > 0) {
    narrow((item) => entities.attributes.includes(item.attributeId));
  }
  if (entities.series.length > 0) {
    narrow((item) => Boolean(item.seriesId && entities.series.includes(item.seriesId)));
  }
  if (hasAnyPhrase(text, ['nguyen seal', 'con seal'])) {
    narrow((item) => item.conditionId === 'new-sealed');
  } else if (hasAnyPhrase(text, ['like new', 'nhu moi'])) {
    narrow((item) => item.conditionId === 'like-new');
  } else if (hasAnyPhrase(text, ['da qua su dung', 'hang cu', 'da su dung'])) {
    narrow((item) => item.conditionId === 'used');
  }
  if (hasAnyPhrase(text, ['dang ban', 'mua ngay', 'mua duoc ngay', 'mo ban roi'])) {
    narrow((item) => item.onSale);
  }
  const budget = extractBudget(text);
  if (budget) narrow((item) => item.price >= budget.min && item.price <= budget.max);

  let sort: ItemSort = 'featured';
  if (hasAnyPhrase(text, ['re nhat', 'gia re', 'gia mem'])) sort = 'cheap';
  else if (hasAnyPhrase(text, ['dat nhat', 'mac nhat', 'cao cap', 'hang hiem', 'hiem'])) {
    sort = 'expensive';
  } else if (hasAnyPhrase(text, ['manh nhat', 'g power cao', 'manh'])) sort = 'strong';
  else if (hasAnyPhrase(text, ['moi nhat', 'moi len'])) sort = 'newest';
  else if (hasAnyPhrase(text, ['ban chay', 'hot nhat', 'hot', 'noi bat'])) sort = 'hot';

  const onSaleFirst = (a: BotItemFact, b: BotItemFact) => Number(b.onSale) - Number(a.onSale);
  const compare: Record<ItemSort, (a: BotItemFact, b: BotItemFact) => number> = {
    cheap: (a, b) => onSaleFirst(a, b) || a.price - b.price,
    expensive: (a, b) => onSaleFirst(a, b) || b.price - a.price,
    strong: (a, b) => onSaleFirst(a, b) || (b.gPower ?? 0) - (a.gPower ?? 0),
    newest: (a, b) => b.feedNumber - a.feedNumber || onSaleFirst(a, b),
    featured: (a, b) => onSaleFirst(a, b) || b.feedNumber - a.feedNumber,
    hot: (a, b) => onSaleFirst(a, b) || b.feedNumber - a.feedNumber,
  };
  return { items: [...pool].sort(compare[sort]), sort, filtered };
}

const SORT_HEADINGS: Record<Exclude<ItemSort, 'featured'>, string> = {
  hot: 'Mỗi con ở shop là duy nhất nên không có mẫu "bán chạy" — đây là vài con ở feed mới nhất',
  cheap: 'Con giá mềm nhất',
  expensive: 'Con giá trị nhất',
  strong: 'Con có G-Power cao nhất',
  newest: 'Con ở feed mới nhất',
};

function titleCase(name: string): string {
  return name ? name[0]!.toUpperCase() + name.slice(1) : name;
}

function listItems(items: readonly BotItemFact[]): string {
  return items.map((item) => `• ${describeItem(item)}`).join('\n');
}

function upcomingFeed(knowledge: BotKnowledge) {
  return [...knowledge.feeds]
    .filter((feed) => feed.status === 'upcoming')
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0];
}

/** Hỏi thẳng một mã: "BK-0231 còn không?" */
function answerByCode(codes: readonly string[], knowledge: BotKnowledge): BotReply {
  const found = codes
    .map((code) => knowledge.items.find((item) => item.code === code))
    .filter((item): item is BotItemFact => Boolean(item));
  const missing = codes.filter((code) => !found.some((item) => item.code === code));
  const lines =
    found.length > 0
      ? [found.length === 1 ? 'Con này vẫn còn nhé:' : 'Những con này vẫn còn:']
      : [];
  lines.push(...found.map((item) => `• ${describeItem(item)}`));
  if (missing.length > 0) {
    lines.push(
      `${missing.join(', ')} không còn bán trên web — có thể đã có người mua (SOLD) hoặc feed đã được gỡ. Bạn gõ mã vào ô tìm kiếm để xem lại nhé.`,
    );
  }
  if (found.length > 0) {
    lines.push(
      found.some((item) => item.onSale)
        ? 'Bấm vào nút bên dưới để mở đúng con đó và thêm vào giỏ nhé.'
        : 'Tới giờ mở bán bạn quay lại thêm vào giỏ nhé — ai chốt đơn trước được trước.',
    );
  }
  return reply(lines.join('\n'), false, { links: found.map(itemLink) });
}

function answerProduct(text: string, entities: ItemEntities, knowledge: BotKnowledge): BotReply {
  if (entities.codes.length > 0) return answerByCode(entities.codes, knowledge);

  const { items: matches, sort, filtered } = pickItems(text, entities, knowledge);
  const named = entities.items.length > 0 || entities.species.length > 0;
  const species = entities.species.map(titleCase).join(' / ');

  if (named && matches.length === 0) {
    const next = upcomingFeed(knowledge);
    return reply(
      `Hiện trên web không còn con ${species || 'nào như bạn tìm'} đang bán — mỗi con là hàng lô duy nhất nên bán rồi là hết (SOLD). ${
        next
          ? `Feed #${next.number} sẽ mở bán ${formatDateTime(next.opensAt)}, bạn xem trước danh sách nhé.`
          : 'Feed mới thường mở bán lúc 20:00, bạn theo dõi mục Feed bán nhé.'
      }`,
      false,
      { links: next ? [feedLink(next)] : [{ label: 'Xem các feed', to: ROUTES.feeds }] },
    );
  }

  if (matches.length > 0) {
    // Hỏi hai tên ("Dragonoid với Hydranoid") -> mỗi tên vài con.
    const shown =
      entities.species.length > 1
        ? entities.species
            .flatMap((name) =>
              matches
                .filter((item) => speciesTokens(item.name).some((token) => sameName(token, name)))
                .slice(0, 2),
            )
            .filter((item, index, list) => list.indexOf(item) === index)
            .slice(0, 4)
        : matches.slice(0, 3);
    const onSale = matches.filter((item) => item.onSale).length;
    let heading = '';
    if (named) {
      heading = `Có ${matches.length} con ${species} còn bán:\n`;
    } else if (sort !== 'featured') {
      heading = `${SORT_HEADINGS[sort]}:\n`;
    } else if (filtered) {
      heading = `Có ${matches.length} con phù hợp:\n`;
    } else {
      heading = `Trên web đang còn ${matches.length} con (${onSale} con mua được ngay). Vài con nổi bật:\n`;
    }
    const more =
      matches.length > shown.length
        ? `\nCòn ${matches.length - shown.length} con khác — bạn cho mình biết hệ / tầm giá để lọc thêm, hoặc nhắn "tư vấn" để mình hỏi từng bước nhé.`
        : '';
    return reply(`${heading}${listItems(shown)}${more}`, false, { links: shown.map(itemLink) });
  }

  if (filtered) {
    return reply(
      'Hiện chưa có con nào đúng như bạn tìm. Bạn thử hệ hoặc tầm giá khác, hoặc nhắn "tư vấn" để mình gợi ý con gần nhất nhé.',
      false,
      { quickReplies: ['Tư vấn giúp mình chọn Bakugan'] },
    );
  }
  const next = upcomingFeed(knowledge);
  return reply(
    `Hiện các feed trên web đều đã bán hết.${
      next
        ? ` Feed #${next.number} sẽ mở bán ${formatDateTime(next.opensAt)}.`
        : ' Feed mới thường mở bán lúc 20:00, bạn quay lại xem nhé.'
    }`,
    false,
    { links: next ? [feedLink(next)] : [] },
  );
}

function answerBuy(text: string, entities: ItemEntities, knowledge: BotKnowledge): BotReply {
  const matches =
    entities.codes.length > 0
      ? knowledge.items.filter((item) => entities.codes.includes(item.code))
      : entities.items.length > 0
        ? pickItems(text, entities, knowledge).items
        : [];
  const shown = matches.slice(0, 2);
  const info = shown.length > 0 ? `${listItems(shown)}\n` : '';
  return reply(
    `${info}${ORDERING_GUIDE} Cần nhân viên lên đơn giúp thì bạn bấm "Gặp nhân viên" nhé.`,
    false,
    {
      links:
        shown.length > 0 ? shown.map(itemLink) : [{ label: 'Xem feed đang bán', to: ROUTES.feeds }],
    },
  );
}

/** "feed 36", "feed #36" -> 36 */
function extractFeedNumber(text: string): number | undefined {
  const match = text.match(/\bfeed ?(\d{1,4})\b/);
  return match ? Number(match[1]) : undefined;
}

/** "Khi nào có hàng mới", "feed sau mở lúc mấy giờ", "feed 36 còn gì" */
function answerFeeds(text: string, entities: ItemEntities, knowledge: BotKnowledge): BotReply {
  const feeds = knowledge.feeds;
  const asked = extractFeedNumber(text);
  if (asked !== undefined) {
    const feed = feeds.find((entry) => entry.number === asked);
    if (!feed) {
      return reply(
        `Feed #${asked} không còn trên web — có thể đã bán hết và được shop gỡ. Bạn xem các feed đang có ở mục Feed bán nhé.`,
        false,
        { links: [{ label: 'Xem các feed', to: ROUTES.feeds }] },
      );
    }
    const left = knowledge.items.filter((item) => item.feedNumber === feed.number);
    const sample = left
      .slice(0, 3)
      .map((item) => `${item.code} ${item.name}`)
      .join(', ');
    return reply(
      `${describeFeed(feed)}.${sample ? ` Còn: ${sample}${left.length > 3 ? '…' : ''}.` : ''}${
        feed.status === 'upcoming' ? ' Tới giờ mở bán mới thêm vào giỏ được nhé.' : ''
      }`,
      false,
      { links: [feedLink(feed)] },
    );
  }
  if (feeds.length === 0) {
    return reply(
      'Hiện chưa có feed nào trên web. Shop đăng feed mới khi nhập lô — thường mở bán lúc 20:00, bạn quay lại xem nhé.',
    );
  }
  const upcoming = feeds.filter((feed) => feed.status === 'upcoming');
  const selling = feeds.filter((feed) => feed.status === 'selling');
  const lines: string[] = [];
  if (upcoming.length > 0) {
    lines.push('Sắp mở bán:', ...upcoming.slice(0, 2).map((feed) => `• ${describeFeed(feed)}`));
  }
  if (selling.length > 0) {
    lines.push('Đang bán:', ...selling.slice(0, 3).map((feed) => `• ${describeFeed(feed)}`));
  }
  if (lines.length === 0) lines.push('Các feed hiện có đều đã bán hết.');

  if (entities.species.length > 0) {
    const name = entities.species.map(titleCase).join(' / ');
    const found = entities.items;
    lines.push(
      found.length > 0
        ? `Con ${name} đang có: ${found
            .slice(0, 3)
            .map(
              (item) =>
                `${item.code} (feed #${item.feedNumber}, ${item.onSale ? 'đang bán' : 'sắp mở bán'})`,
            )
            .join(', ')}.`
        : `Hiện chưa có con ${name} nào trên web.`,
    );
  }
  if (hasAnyPhrase(text, ['dat truoc', 'dat hang truoc', 'pre order', 'giu'])) {
    lines.push(FEED_GUIDE[2]!);
  } else {
    lines.push(
      'Shop nhập theo lô, mỗi con là duy nhất; feed mới thường đăng trước rồi mở bán lúc 20:00.',
    );
  }
  // Nhờ báo khi có mẫu mình cần -> để nhân viên ghi lại.
  const wantsNotice = hasAnyPhrase(text, ['bao khi co hang', 'bao minh', 'nhan tin cho minh']);
  const links = [...upcoming.slice(0, 1), ...selling.slice(0, 2)].map(feedLink);
  return reply(lines.join('\n'), wantsNotice, { links });
}

function answerMembership(text: string, knowledge: BotKnowledge): BotReply {
  const { membership } = knowledge;
  const mine = describeMembership(membership)?.replace(/Khách/g, 'Bạn');
  const isMember = (membership.level ?? 1) >= AUCTION_MIN_LEVEL;
  const [intro, ways] = membershipRules(membership.depositAmount);
  const membershipLink: ChatLink = { label: 'Mở mục Hạng thành viên', to: ROUTES.membership };

  if (!knowledge.isSignedIn) {
    return reply(
      `${intro}\n${ways}\nBạn đăng nhập để xem hạng của mình và gửi yêu cầu lên Lv2 nhé.`,
      false,
      {
        links: [{ label: 'Đăng nhập', to: ROUTES.login }],
      },
    );
  }
  if (isMember) {
    return reply(mine ?? intro!, false, {
      links: [{ label: 'Xem phiên đấu giá', to: ROUTES.auctions }],
    });
  }
  // Đã gửi yêu cầu -> chỉ cần báo đang chờ, không liệt kê lại các cách.
  if (membership.pendingRequest) {
    return reply(`${mine}\nShop sẽ cập nhật ngay khi xử lý xong, thường trong ngày.`, false, {
      links: [membershipLink],
    });
  }

  const aboutDeposit = hasAnyPhrase(text, [
    'nap tien',
    'nap coc',
    'tien coc',
    'nap bao nhieu',
    'chuyen khoan',
    'muon nap',
    'nap',
  ]);
  if (aboutDeposit) {
    const amount = `Nạp ${formatCurrency(membership.depositAmount)} là lên Lv2 sau khi shop xác nhận.`;
    if (!membership.bankConfigured) {
      return reply(
        `${amount} Mình chuyển nhân viên gửi số tài khoản cho bạn nhé — nhớ ghi đúng nội dung chuyển khoản để shop đối soát.`,
        true,
      );
    }
    return reply(
      `${amount} Số tài khoản và nội dung chuyển khoản nằm ở Tài khoản → Hạng thành viên; chuyển xong bạn bấm "Tôi đã chuyển khoản" để shop đối soát nhé.`,
      false,
      { links: [membershipLink] },
    );
  }
  return reply(`${mine}\n${ways}`, false, { links: [membershipLink] });
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
  const abroad = hasAnyPhrase(text, [
    'nuoc ngoai',
    'quoc te',
    'ship qua',
    'gui qua',
    'ship sang',
    'gui sang',
    'viet kieu',
    'nhat ban',
    'han quoc',
    'dai loan',
    'singapore',
    'canada',
    'chau au',
    'qua my',
    'sang my',
    'ben my',
    'qua uc',
    'sang uc',
    'ben uc',
    'overseas',
    'international',
    'internationally',
    'abroad',
    'worldwide',
    'usa',
  ]);
  if (abroad) return reply(internationalShippingLine(knowledge.checkout));

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

function answerPayment(text: string, knowledge: BotKnowledge): BotReply {
  const card = cardPaymentLine(knowledge.checkout);
  const aboutCard = hasAnyPhrase(text, [
    'visa',
    'mastercard',
    'master card',
    'jcb',
    'the tin dung',
    'the ghi no',
    'the quoc te',
    'quet the',
    'tra bang the',
    'credit card',
    'debit card',
  ]);
  if (aboutCard) {
    return reply(
      card ?? 'Hiện shop tạm ngưng nhận thanh toán thẻ — bạn chọn COD, chuyển khoản hoặc MoMo nhé.',
    );
  }
  const lines = [PAYMENT_POLICY[0]!, ...(card ? [card] : []), PAYMENT_POLICY[1]!];
  if (hasAnyPhrase(text, ['dau gia', 'thang'])) lines.push(PAYMENT_POLICY[2]!);
  if (hasAnyPhrase(text, ['so tai khoan', 'chuyen khoan', 'qr', 'quet ma'])) {
    lines.push(
      'Chọn "Chuyển khoản" khi chốt đơn, trang xác nhận đơn sẽ hướng dẫn chuyển khoản kèm nội dung là mã đơn.',
    );
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
    hasAnyPhrase(text, ['ai dat', 'ten nguoi', 'nguoi dat', 'ai dang', 'bao nhieu nguoi', 'an ten'])
  ) {
    parts.push(
      'Web không công khai tên người đặt giá: mọi người chỉ thấy giá cao nhất và số người đã đặt (biểu tượng cây búa). Bạn vẫn xem được các lượt đặt của chính mình.',
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
      `Cách tham gia: đăng nhập bằng tài khoản thành viên Lv${AUCTION_MIN_LEVEL} trở lên, vào mục Đấu giá, chọn phiên đang diễn ra và nhập mức giá từ giá hiện tại cộng bước giá trở lên. Lượt đặt là cam kết mua nên không huỷ được. Chưa đủ Lv${AUCTION_MIN_LEVEL} thì nhắn "lên Lv2" để mình chỉ cách.`,
    );
  }
  if (hasAnyPhrase(text, ['thang', 'thanh toan', 'nhan hang'])) {
    parts.push(
      'Người thắng được shop liên hệ trong 24 giờ và cần thanh toán trong 48 giờ; hàng đấu giá không áp dụng đổi trả.',
    );
  }
  if (parts.length === 0) {
    parts.push(
      `Đấu giá ở TD Bakugan có luật chống bắn tỉa (đặt trong 5 phút cuối thì phiên tự cộng thêm 5 phút), phiên kín (giấu giá hiện tại) và không công khai tên người đặt. Chỉ thành viên Lv${AUCTION_MIN_LEVEL} trở lên được đặt giá; người thắng thanh toán trong 48 giờ.`,
    );
  }
  return reply(parts.join('\n'), false, {
    links: [{ label: 'Xem phiên đấu giá', to: ROUTES.auctions }],
  });
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
      ? `Mã đang có (nhập trong Giỏ hàng):\n${knowledge.coupons.map((coupon) => `• ${coupon.code}: ${coupon.label}`).join('\n')}`
      : 'Hiện shop chưa có mã giảm giá nào đang chạy ạ.';
  return reply(`${freeShip}${coupons}`);
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

function answerKnowledge(text: string, entities: ItemEntities): BotReply {
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
    return reply(`Các dòng Bakugan: ${describeSeries()}.`);
  }
  return reply(
    `${BAKUGAN_BASICS[0]} Có ${BAKUGAN_ATTRIBUTES.length} hệ; shop có hàng từ Battle Brawlers đời đầu tới Geogan Rising. Mới tìm hiểu thì nhắn "tư vấn" để mình giúp chọn con đầu tiên nhé.`,
    false,
    { quickReplies: ['Tư vấn giúp mình chọn Bakugan'] },
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
  'membership',
  'bakugan-knowledge',
]);

interface AnswerInput {
  text: string;
  topics: ReadonlySet<BotTopicId>;
  knowledge: BotKnowledge;
  entities: ItemEntities;
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
      return answerBuy(text, entities, knowledge);
    case 'order-status':
      return answerOrder(text, knowledge);
    case 'auction-rules':
      return answerAuction(text);
    case 'promotions':
      return answerPromotions(text, topics, knowledge);
    case 'shipping':
      return answerShipping(text, knowledge);
    case 'payment':
      return answerPayment(text, knowledge);
    case 'returns':
      return answerReturns(text);
    case 'product-info':
      return answerProduct(text, entities, knowledge);
    case 'feeds':
      return answerFeeds(text, entities, knowledge);
    case 'membership':
      return answerMembership(text, knowledge);
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
        'Chào bạn! Mình là trợ lý AI của TD Bakugan. Bạn muốn xem feed đang bán, nhờ mình tư vấn chọn Bakugan, tra đơn hay hỏi luật đấu giá ạ?',
        false,
        {
          quickReplies: topics.has('product-info')
            ? ['Tư vấn giúp mình chọn Bakugan', 'Feed nào đang mở bán?']
            : [],
        },
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

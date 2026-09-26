/* ============================================================
   Chuẩn hoá tin nhắn tiếng Việt cho bot: bỏ dấu, bỏ ký tự lạ và
   mở rộng các kiểu viết tắt hay gặp khi chat ("ko", "dc", "sp"…),
   để một câu hỏi viết theo nhiều cách vẫn được hiểu giống nhau.
   ============================================================ */

/** Viết tắt → dạng đầy đủ (đã bỏ dấu). Chỉ thay khi đứng thành một từ riêng. */
const ABBREVIATIONS: Record<string, string> = {
  k: 'khong',
  ko: 'khong',
  kh: 'khong',
  hk: 'khong',
  hok: 'khong',
  khum: 'khong',
  kg: 'khong',
  dc: 'duoc',
  sp: 'san pham',
  sdt: 'so dien thoai',
  dt: 'dien thoai',
  stk: 'so tai khoan',
  mk: 'minh',
  mik: 'minh',
  ntn: 'nhu the nao',
  bh: 'bao gio',
  bnhieu: 'bao nhieu',
  bnh: 'bao nhieu',
  baonhieu: 'bao nhieu',
  nhiu: 'nhieu',
  j: 'gi',
  gj: 'gi',
  r: 'roi',
  ms: 'moi',
  vs: 'voi',
  trc: 'truoc',
  ad: 'admin',
  sop: 'shop',
  order: 'dat hang',
  oder: 'dat hang',
  cancel: 'huy',
  cancle: 'huy',
  tks: 'cam on',
  thanks: 'cam on',
  thank: 'cam on',
  thx: 'cam on',
  camon: 'cam on',
  oke: 'ok',
  okie: 'ok',
  oki: 'ok',
  okay: 'ok',
  hcm: 'ho chi minh',
  tphcm: 'ho chi minh',
  sg: 'sai gon',
  hn: 'ha noi',
  fs: 'freeship',
  km: 'khuyen mai',
  ib: 'nhan tin',
  inb: 'nhan tin',
  ck: 'chuyen khoan',
  vc: 'van chuyen',
  gpower: 'g power',
};

/** "Dragonoid còn ko sh0p??" -> "dragonoid con khong sh0p" */
export function normalizeText(input: string): string {
  const plain = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ');

  return plain
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ');
}

/** Câu (đã chuẩn hoá) có chứa cụm từ này như một cụm từ nguyên vẹn không. */
export function hasPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

export function hasAnyPhrase(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

/** Mã đơn dạng TD2609A17 (khách hay gõ kèm dấu cách hoặc dấu #). */
const ORDER_CODE = /\btd ?(\d{4}) ?([a-z]) ?(\d{2})\b/;

export function extractOrderCode(normalized: string): string | undefined {
  const match = normalized.match(ORDER_CODE);
  if (!match) return undefined;
  return `TD${match[1]}${match[2]!.toUpperCase()}${match[3]}`;
}

/** Bỏ mã đơn khỏi câu, để xét phần chữ còn lại. */
export function stripOrderCode(normalized: string): string {
  return normalized.replace(new RegExp(ORDER_CODE.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Đọc ngân sách khách nói trong câu: "dưới 1 triệu", "tầm 500k", "khoảng 1tr2".
 * Trả về khoảng giá, hoặc undefined nếu không có.
 */
export function extractBudget(normalized: string): { min: number; max: number } | undefined {
  const match = normalized.match(
    /\b(duoi|khong qua|toi da|tam|khoang|tren|tu)\s+(\d+(?:\s\d+)?)\s*(k|nghin|ngan|tr|trieu|cu|m)?\b/,
  );
  if (!match) return undefined;
  const [, kind, amountRaw, unitRaw] = match;
  const amount = Number(amountRaw!.replace(' ', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  let unit = 1;
  if (unitRaw === 'k' || unitRaw === 'nghin' || unitRaw === 'ngan') unit = 1_000;
  else if (unitRaw === 'tr' || unitRaw === 'trieu' || unitRaw === 'cu' || unitRaw === 'm') {
    unit = 1_000_000;
  } else if (amount < 100) unit = 1_000_000;
  else if (amount < 100_000) unit = 1_000;
  const value = amount * unit;

  if (kind === 'duoi' || kind === 'khong qua' || kind === 'toi da') return { min: 0, max: value };
  if (kind === 'tren' || kind === 'tu') return { min: value, max: Number.MAX_SAFE_INTEGER };
  return { min: value * 0.7, max: value * 1.3 };
}

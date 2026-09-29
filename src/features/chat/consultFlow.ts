import type {
  BakuganAttribute,
  BotReply,
  ChatLink,
  ConsultAnswers,
  ConsultPurpose,
  ConsultState,
  ConsultStep,
  ProductCondition,
} from '@/types';
import { BAKUGAN_ATTRIBUTES } from '@/types';
import { ATTRIBUTE_META } from '@/constants/catalog';
import { CONSULT_STARTER } from '@/constants/chat';
import { ROUTES } from '@/constants/routes';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { itemLink, type BotItemFact, type BotKnowledge } from './botKnowledge';
import { extractBudget, hasAnyPhrase, normalizeText } from './textNormalize';

/* ============================================================
   Tư vấn chọn Bakugan cho khách mới.

   Trợ lý hỏi lần lượt 4 câu (mục đích → hệ → ngân sách → tình trạng),
   mỗi câu có sẵn nút trả lời, rồi chọn ra vài con đang bán phù hợp nhất
   kèm nút mở đúng con đó trong feed. Chạy bằng luật cố định nên luôn
   trả lời ngay, kể cả khi chưa có khoá Gemini.

   Câu khách đã nói sẵn trong lời nhờ tư vấn ("con hệ lửa dưới 500k để
   chơi") được hiểu luôn, không hỏi lại.
   ============================================================ */

const STEPS: readonly ConsultStep[] = ['purpose', 'attribute', 'budget', 'condition'];
/** Bỏ dở lâu quá thì coi như đã xong, câu sau được trả lời bình thường. */
const CONSULT_TTL_MS = 30 * 60 * 1000;
const MAX_PICKS = 3;
const NO_LIMIT = Number.MAX_SAFE_INTEGER;

const START_PHRASES = [
  'tu van chon',
  'tu van giup',
  'tu van cho minh',
  'tu van minh',
  'tu van lai',
  'can tu van',
  'nho tu van',
  'bat dau tu van',
  'chon giup',
  'chon dum',
  'chon ho',
  'chon bakugan',
  'nguoi moi',
  'moi choi',
  'moi bat dau',
  'moi tim hieu',
  'chua biet gi',
  'chua biet chon',
  'khong biet chon',
  'khong biet mua',
  'nen mua con nao',
  'nen chon con nao',
  'nen mua gi',
  'nen bat dau',
  'goi y giup',
  'goi y cho minh',
];

/** Có mấy chữ này thì khách đang hỏi việc khác (hoặc hỏi thẳng một điều), không phải nhờ chọn từng bước. */
const OTHER_TOPICS = [
  'manh nhat',
  're nhat',
  'dat nhat',
  'mac nhat',
  'hiem nhat',
  'con hang',
  'ship',
  'giao hang',
  'van chuyen',
  'doi tra',
  'bao hanh',
  'thanh toan',
  'chuyen khoan',
  'dau gia',
  'don hang',
  'ma don',
  'huy',
  'lv2',
  'len hang',
  'thanh vien',
  'dia chi',
  'mat khau',
  'tai khoan',
];

const EXIT_MESSAGES = new Set([
  'thoi',
  'thoi khong can',
  'thoi khong can nua',
  'khong can nua',
  'dung',
  'dung lai',
  'huy',
  'ket thuc',
  'bo qua het',
  'stop',
]);
const EXIT_PHRASES = ['huy tu van', 'dung tu van', 'thoat tu van', 'khong can tu van', 'bo tu van'];

/* ---------------- Hiểu câu trả lời ---------------- */

interface Choice<T> {
  value: T;
  /** Cụm từ rõ nghĩa — hiểu được cả trong lời nhờ tư vấn ban đầu */
  phrases: readonly string[];
  /** Từ ngắn chỉ rõ nghĩa khi đang hỏi đúng câu này ("lửa" khi đang hỏi hệ) */
  loose?: readonly string[];
}

const ANY_PHRASES = [
  'sao cung duoc',
  'gi cung duoc',
  'nao cung duoc',
  'bao nhieu cung duoc',
  'the nao cung duoc',
  'khong quan trong',
  'khong gioi han',
  'bat ky',
  'chua ro',
  'chua biet',
  'khong biet',
  'tuy ban',
  'tuy shop',
  'goi y giup',
];

const PURPOSES: ReadonlyArray<Choice<ConsultPurpose>> = [
  {
    value: 'gift',
    phrases: [
      'lam qua',
      'qua tang',
      'de tang',
      'mua tang',
      'tang ban',
      'tang con',
      'tang be',
      'sinh nhat',
    ],
    loose: ['qua', 'tang'],
  },
  {
    value: 'collect',
    phrases: ['suu tam', 'suu tap', 'trung bay', 'collect'],
  },
  {
    value: 'play',
    phrases: [
      'de choi',
      'choi dau',
      'thi dau',
      'chien dau',
      'battle',
      'cho con choi',
      'cho be choi',
      'moi choi',
    ],
    // Không dùng "dau": bỏ dấu thì trùng với "đâu", "đầu".
    loose: ['choi'],
  },
  {
    value: 'unsure',
    phrases: ['chua ro', 'chua biet', 'khong biet', 'goi y giup', 'nguoi moi', 'moi tim hieu'],
  },
];

/** Khách có thể trả lời bằng màu ("xanh lá") thay vì tên hệ. */
const ATTRIBUTE_CHOICES: ReadonlyArray<Choice<BakuganAttribute>> = [
  { value: 'pyrus', phrases: ['pyrus', 'he lua'], loose: ['lua', 'mau do'] },
  { value: 'aquos', phrases: ['aquos', 'he nuoc'], loose: ['nuoc', 'xanh duong', 'xanh bien'] },
  { value: 'subterra', phrases: ['subterra', 'he dat'], loose: ['dat', 'nau', 'mau cam'] },
  {
    value: 'haos',
    phrases: ['haos', 'he anh sang'],
    loose: ['anh sang', 'mau vang', 'mau trang'],
  },
  {
    value: 'darkus',
    phrases: ['darkus', 'he bong toi'],
    loose: ['bong toi', 'mau den', 'mau tim'],
  },
  { value: 'ventus', phrases: ['ventus', 'he gio'], loose: ['gio', 'xanh la'] },
];

/** Màu một chữ chỉ tính khi cả câu chỉ có chữ đó ("đỏ", "đen") — tránh trùng "đó", "đến". */
const COLOR_ONLY: Readonly<Record<string, BakuganAttribute>> = {
  do: 'pyrus',
  cam: 'subterra',
  trang: 'haos',
  den: 'darkus',
  tim: 'darkus',
};

/** Thứ tự kiểm tra quan trọng: "như mới" có chữ "mới", "đã qua sử dụng" có chữ "qua". */
const CONDITION_CHOICES: ReadonlyArray<Choice<ProductCondition>> = [
  { value: 'like-new', phrases: ['like new', 'nhu moi', 'gan nhu moi'], loose: ['99'] },
  {
    value: 'used',
    phrases: ['da qua su dung', 'qua su dung', 'da su dung', 'hang cu', 'second hand'],
    loose: ['cu', 'used', 'da dung', 'da choi'],
  },
  {
    value: 'new-sealed',
    phrases: ['nguyen seal', 'con seal', 'chua boc', 'nguyen hop', 'moi nguyen'],
    loose: ['seal', 'moi', 'new'],
  },
];

const BUDGET_CHOICES: ReadonlyArray<{ label: string; range: { min: number; max: number } }> = [
  { label: 'Dưới 500k', range: { min: 0, max: 500_000 } },
  { label: '500k – 1 triệu', range: { min: 500_000, max: 1_000_000 } },
  { label: '1 – 2 triệu', range: { min: 1_000_000, max: 2_000_000 } },
  { label: 'Trên 2 triệu', range: { min: 2_000_000, max: NO_LIMIT } },
];

function pick<T>(text: string, choices: ReadonlyArray<Choice<T>>, strict: boolean): T[] {
  return choices
    .filter(
      (choice) =>
        hasAnyPhrase(text, choice.phrases) || (!strict && hasAnyPhrase(text, choice.loose ?? [])),
    )
    .map((choice) => choice.value);
}

/**
 * "500k", "1 triệu", "1tr5", hay chỉ "700" không kèm "dưới / tầm…" — hiểu là
 * khoảng chừng đó.
 */
function bareAmount(text: string): { min: number; max: number } | undefined {
  let value: number | undefined;
  const withUnit = text.match(/\b(\d+)\s*(k|nghin|ngan|tr|trieu|cu)(\d{1,3})?\b/);
  if (withUnit) {
    const amount = Number(withUnit[1]);
    const thousands = ['k', 'nghin', 'ngan'].includes(withUnit[2]!);
    // "1tr5" = 1,5 triệu
    value = thousands
      ? amount * 1_000
      : (amount + (withUnit[3] ? Number(`0.${withUnit[3]}`) : 0)) * 1_000_000;
  } else if (/^\d+$/.test(text)) {
    const amount = Number(text);
    value = amount < 100 ? amount * 1_000_000 : amount < 100_000 ? amount * 1_000 : amount;
  }
  if (!value || !Number.isFinite(value)) return undefined;
  return { min: Math.round(value * 0.6), max: Math.round(value * 1.2) };
}

/**
 * - `strict`: chỉ cụm từ rõ nghĩa — đọc lời nhờ tư vấn ban đầu.
 * - `answer`: đang hỏi đúng câu này — hiểu cả từ ngắn và "sao cũng được".
 * - `aside` : khách trả lời trước một câu chưa hỏi — hiểu từ ngắn nhưng không
 *   hiểu "sao cũng được" (không biết khách nói về câu nào).
 */
type ParseMode = 'strict' | 'answer' | 'aside';

function parseBudget(text: string, mode: ParseMode): ConsultAnswers['budget'] | undefined {
  const chip = BUDGET_CHOICES.find((choice) => normalizeText(choice.label) === text);
  if (chip) return chip.range;
  const said = extractBudget(text);
  if (said) return { min: Math.round(said.min), max: Math.round(said.max) };
  if (mode === 'strict') return undefined;
  if (mode === 'answer' && hasAnyPhrase(text, ANY_PHRASES)) return 'any';
  return bareAmount(text);
}

/** Đọc câu trả lời cho một câu hỏi. undefined = chưa hiểu. */
function parseAnswer(
  step: ConsultStep,
  text: string,
  mode: ParseMode,
): Partial<ConsultAnswers> | undefined {
  const strict = mode === 'strict';
  const acceptsAny = mode === 'answer' && hasAnyPhrase(text, ANY_PHRASES);
  switch (step) {
    case 'purpose': {
      const [purpose] = pick(text, PURPOSES, strict);
      if (purpose) return { purpose };
      return acceptsAny ? { purpose: 'unsure' } : undefined;
    }
    case 'attribute': {
      const attributes = pick(text, ATTRIBUTE_CHOICES, strict);
      if (attributes.length > 0) return { attributes };
      if (strict) return undefined;
      const color = COLOR_ONLY[text.replace(/^mau /, '')];
      if (color) return { attributes: [color] };
      return acceptsAny ? { attributes: [] } : undefined;
    }
    case 'budget': {
      const budget = parseBudget(text, mode);
      return budget ? { budget } : undefined;
    }
    case 'condition':
    default: {
      // "Không cần seal" -> sao cũng được, không phải "muốn seal".
      if (acceptsAny || (mode === 'answer' && hasAnyPhrase(text, ['khong can']))) {
        return { condition: 'any' };
      }
      const [condition] = pick(text, CONDITION_CHOICES, strict);
      return condition ? { condition } : undefined;
    }
  }
}

function isAnswered(answers: ConsultAnswers, step: ConsultStep): boolean {
  switch (step) {
    case 'purpose':
      return Boolean(answers.purpose);
    case 'attribute':
      return Boolean(answers.attributes);
    case 'budget':
      return Boolean(answers.budget);
    default:
      return Boolean(answers.condition);
  }
}

function nextStep(answers: ConsultAnswers): ConsultStep | undefined {
  return STEPS.find((step) => !isAnswered(answers, step));
}

/* ---------------- Câu hỏi ---------------- */

const PURPOSE_LABELS: Record<ConsultPurpose, string> = {
  play: 'để chơi đấu',
  collect: 'để sưu tầm',
  gift: 'làm quà',
  unsure: 'chưa rõ mục đích',
};

const ATTRIBUTE_COLORS: Record<BakuganAttribute, string> = {
  pyrus: 'đỏ',
  aquos: 'xanh dương',
  subterra: 'nâu cam',
  haos: 'vàng trắng',
  darkus: 'đen tím',
  ventus: 'xanh lá',
};

const CONDITION_TEXT: Record<ProductCondition, { chip: string; line: string }> = {
  'new-sealed': {
    chip: 'Nguyên seal',
    line: 'Nguyên seal: còn nguyên hộp, chưa bóc — hợp sưu tầm, làm quà',
  },
  'like-new': { chip: 'Like new', line: 'Like new: đã mở hộp nhưng gần như mới' },
  used: {
    chip: 'Đã qua sử dụng',
    line: 'Đã qua sử dụng: có dấu vết dùng nhẹ, giá mềm — hợp để chơi',
  },
};

function budgetLabel(budget: ConsultAnswers['budget']): string {
  if (!budget || budget === 'any') return 'ngân sách tuỳ';
  if (budget.max >= NO_LIMIT) return `từ ${formatCurrency(budget.min)}`;
  if (budget.min <= 0) return `dưới ${formatCurrency(budget.max)}`;
  return `${formatCurrency(budget.min)} – ${formatCurrency(budget.max)}`;
}

function attributeLabel(attributes: readonly BakuganAttribute[] | undefined): string {
  if (!attributes || attributes.length === 0) return 'hệ nào cũng được';
  return `hệ ${attributes.map((value) => ATTRIBUTE_META[value].label).join(' / ')}`;
}

function inAttributes(item: BotItemFact, attributes: readonly BakuganAttribute[] | undefined) {
  if (!attributes || attributes.length === 0) return true;
  // Hệ shop gõ mà bot không nhận ra thì chỉ hợp với "hệ nào cũng được".
  return Boolean(item.attributeId && attributes.includes(item.attributeId));
}

function ask(
  step: ConsultStep,
  answers: ConsultAnswers,
  knowledge: BotKnowledge,
  intro = '',
): BotReply {
  const number = STEPS.indexOf(step) + 1;
  const head = `${intro}Câu ${number}/${STEPS.length}: `;
  const items = knowledge.items;

  switch (step) {
    case 'purpose':
      return {
        reply: `${head}Bạn chọn Bakugan để làm gì?`,
        quickReplies: ['Để chơi đấu', 'Để sưu tầm', 'Mua làm quà', 'Chưa rõ, gợi ý giúp mình'],
        handoff: false,
        source: 'rules',
      };
    case 'attribute': {
      const lines = BAKUGAN_ATTRIBUTES.map((value) => {
        const meta = ATTRIBUTE_META[value];
        const count = items.filter((item) => item.attributeId === value).length;
        const trait = meta.description.split('—')[1]?.trim() ?? meta.description;
        return `• ${meta.label} – ${meta.element} (${ATTRIBUTE_COLORS[value]}): ${trait} · ${count > 0 ? `đang có ${count} con` : 'tạm hết'}`;
      });
      const tip =
        answers.purpose === 'gift'
          ? 'Người nhận thích màu nào thì chọn hệ đó nhé. '
          : answers.purpose === 'play'
            ? 'Hệ nào cũng đấu được, chọn theo sở thích nhé. '
            : '';
      return {
        reply: `${head}Bạn thích hệ nào? ${tip}Mỗi hệ là một nguyên tố:\n${lines.join('\n')}`,
        quickReplies: [
          ...BAKUGAN_ATTRIBUTES.filter((value) =>
            items.some((item) => item.attributeId === value),
          ).map((value) => `${ATTRIBUTE_META[value].label} (${ATTRIBUTE_META[value].element})`),
          'Hệ nào cũng được',
        ],
        handoff: false,
        source: 'rules',
      };
    }
    case 'budget': {
      const pool = items.filter((item) => inAttributes(item, answers.attributes));
      const prices = pool.map((item) => item.price);
      const who = answers.attributes?.length
        ? `Hệ ${answers.attributes.map((value) => ATTRIBUTE_META[value].label).join(' / ')}`
        : 'Hàng';
      const range =
        prices.length > 0
          ? ` ${who} đang bán có giá từ ${formatCurrency(Math.min(...prices))} đến ${formatCurrency(Math.max(...prices))}.`
          : '';
      return {
        reply: `${head}Ngân sách của bạn khoảng bao nhiêu?${range}`,
        quickReplies: [...BUDGET_CHOICES.map((choice) => choice.label), 'Chưa rõ'],
        handoff: false,
        source: 'rules',
      };
    }
    case 'condition':
    default: {
      const order: ProductCondition[] =
        answers.purpose === 'play'
          ? ['used', 'like-new', 'new-sealed']
          : ['new-sealed', 'like-new', 'used'];
      return {
        reply: `${head}Bạn muốn tình trạng thế nào?\n${order.map((value) => `• ${CONDITION_TEXT[value].line}`).join('\n')}`,
        quickReplies: [...order.map((value) => CONDITION_TEXT[value].chip), 'Sao cũng được'],
        handoff: false,
        source: 'rules',
      };
    }
  }
}

/* ---------------- Gợi ý ---------------- */

function inBudget(item: BotItemFact, budget: ConsultAnswers['budget']): boolean {
  return !budget || budget === 'any' || (item.price >= budget.min && item.price <= budget.max);
}

/** Lệch khỏi ngân sách bao nhiêu phần (0 = nằm trong khoảng). */
function budgetGap(item: BotItemFact, budget: ConsultAnswers['budget']): number {
  if (!budget || budget === 'any') return 0;
  if (item.price < budget.min) return (budget.min - item.price) / Math.max(budget.min, 1);
  if (item.price > budget.max) return (item.price - budget.max) / Math.max(budget.max, 1);
  return 0;
}

function fitScore(item: BotItemFact, answers: ConsultAnswers): number {
  let score = item.onSale ? 6 : 0;
  // Đã phải nới tình trạng thì vẫn ưu tiên con gần ý khách nhất.
  if (answers.condition === 'new-sealed' && item.conditionId === 'like-new') score += 3;
  if (answers.condition === 'used' && item.conditionId === 'like-new') score += 3;
  switch (answers.purpose) {
    case 'play':
      // Để chơi thì ưu tiên giá mềm (không còn G-Power để so sức mạnh).
      score += Math.max(0, 1 - item.price / 2_000_000) * 6;
      if (item.conditionId !== 'new-sealed') score += 4;
      break;
    case 'collect':
      if (item.conditionId === 'new-sealed') score += 8;
      else if (item.conditionId === 'like-new') score += 4;
      score += Math.min(item.price / 1_000_000, 3) * 2;
      break;
    case 'gift':
      if (item.conditionId === 'new-sealed') score += 8;
      else if (item.conditionId === 'like-new') score += 5;
      break;
    default:
      // Người mới: giá vừa phải, dễ chơi.
      if (item.price <= 1_000_000) score += 4;
      if (item.conditionId === 'like-new') score += 2;
  }
  return score;
}

interface Relaxation {
  /** Phần nào đã phải nới để tìm ra hàng */
  relaxed: string;
  keep: (item: BotItemFact) => boolean;
}

function recommend(answers: ConsultAnswers, items: readonly BotItemFact[]) {
  const attr = (item: BotItemFact) => inAttributes(item, answers.attributes);
  const cond = (item: BotItemFact) =>
    !answers.condition || answers.condition === 'any' || item.conditionId === answers.condition;
  const money = (item: BotItemFact) => inBudget(item, answers.budget);

  const levels: Relaxation[] = [
    { relaxed: '', keep: (item) => attr(item) && money(item) && cond(item) },
    { relaxed: 'tình trạng', keep: (item) => attr(item) && money(item) },
    { relaxed: 'ngân sách', keep: (item) => attr(item) && cond(item) },
    { relaxed: 'ngân sách và tình trạng', keep: attr },
    { relaxed: 'hệ', keep: () => true },
  ];
  const rank = (pool: BotItemFact[]) =>
    [...pool].sort(
      (a, b) =>
        budgetGap(a, answers.budget) - budgetGap(b, answers.budget) ||
        fitScore(b, answers) - fitScore(a, answers),
    );

  const firstLevel = levels.findIndex((level) => items.some(level.keep));
  if (firstLevel < 0) return { picks: [], extras: [], relaxed: '', extrasRelaxed: '' };
  const picks = rank(items.filter(levels[firstLevel]!.keep)).slice(0, MAX_PICKS);

  // Chưa được 3 con -> thêm vài con gần đúng để khách có lựa chọn.
  let extras: BotItemFact[] = [];
  let extrasRelaxed = '';
  if (picks.length < MAX_PICKS) {
    const chosen = new Set(picks.map((item) => item.code));
    const nextLevel = levels
      .slice(firstLevel + 1)
      .find((level) => items.some((item) => level.keep(item) && !chosen.has(item.code)));
    if (nextLevel) {
      extrasRelaxed = nextLevel.relaxed;
      extras = rank(items.filter((item) => nextLevel.keep(item) && !chosen.has(item.code))).slice(
        0,
        MAX_PICKS - picks.length,
      );
    }
  }
  return { picks, extras, relaxed: levels[firstLevel]!.relaxed, extrasRelaxed };
}

/** Những con thêm vào "gần đúng" khác yêu cầu ở chỗ nào. */
const EXTRA_NOTES: Record<string, string> = {
  'tình trạng': 'khác tình trạng',
  'ngân sách': 'lệch ngân sách',
  'ngân sách và tình trạng': 'lệch ngân sách / tình trạng',
  hệ: 'khác hệ',
};

const WHY: Record<ConsultPurpose, string> = {
  play: 'Để chơi, hàng like new / đã qua sử dụng giá mềm mà vẫn bung nở tốt; muốn biết con nào mạnh hơn khi đấu thì nhắn shop tư vấn thêm nhé.',
  collect:
    'Để sưu tầm, hàng nguyên seal giữ giá tốt nhất; nhớ xem kỹ ảnh và ghi chú tình trạng của từng con.',
  gift: 'Làm quà thì hàng nguyên seal hoặc like new là đẹp nhất; shop đóng gói chống sốc hai lớp.',
  unsure:
    'Mới bắt đầu thì chọn con giá vừa phải để vừa chơi vừa tìm hiểu; thích rồi hãy sưu tầm hàng seal.',
};

function conditionSummary(condition: ConsultAnswers['condition']): string {
  if (!condition || condition === 'any') return 'tình trạng nào cũng được';
  return CONDITION_TEXT[condition].chip.toLowerCase();
}

/** Một dòng ngắn cho mỗi con được gợi ý (chi tiết đầy đủ nằm trong trang feed). */
function describePick(item: BotItemFact, showAttribute: boolean): string {
  const parts = [
    showAttribute && item.attribute && `hệ ${item.attribute}`,
    item.condition,
    item.onSale
      ? `feed #${item.feedNumber}`
      : `feed #${item.feedNumber}, mở bán ${formatDateTime(item.opensAt)}`,
  ].filter(Boolean);
  return `• ${item.code} ${item.name} — ${formatCurrency(item.price)} · ${parts.join(' · ')}`;
}

function soldOutReply(): BotReply {
  return {
    reply:
      'Hiện các feed trên web đều đã bán hết. Feed mới thường mở bán lúc 20:00 — bạn quay lại xem nhé, hoặc bấm "Gặp nhân viên" để shop tìm giúp.',
    links: [{ label: 'Xem các feed', to: ROUTES.feeds }],
    quickReplies: ['Tư vấn lại từ đầu'],
    handoff: false,
    source: 'rules',
  };
}

/** "hệ Pyrus · dưới 500.000₫" — những ý khách đã nói sẵn khi nhờ tư vấn. */
function understood(answers: ConsultAnswers): string {
  return [
    answers.purpose && answers.purpose !== 'unsure' && PURPOSE_LABELS[answers.purpose],
    answers.attributes?.length && attributeLabel(answers.attributes),
    answers.budget && answers.budget !== 'any' && budgetLabel(answers.budget),
    answers.condition && answers.condition !== 'any' && conditionSummary(answers.condition),
  ]
    .filter(Boolean)
    .join(' · ');
}

function result(answers: ConsultAnswers, knowledge: BotKnowledge): BotReply {
  const summary = [
    PURPOSE_LABELS[answers.purpose ?? 'unsure'],
    attributeLabel(answers.attributes),
    budgetLabel(answers.budget),
    conditionSummary(answers.condition),
  ].join(' · ');
  const { picks, extras, relaxed, extrasRelaxed } = recommend(answers, knowledge.items);
  const browse: ChatLink =
    answers.attributes?.length === 1
      ? {
          label: `Xem mọi con hệ ${ATTRIBUTE_META[answers.attributes[0]!].label}`,
          to: `${ROUTES.feeds}?he=${answers.attributes[0]}`,
        }
      : { label: 'Xem tất cả feed đang bán', to: ROUTES.feeds };

  if (picks.length === 0) return soldOutReply();

  const showAttribute = answers.attributes?.length !== 1;
  const lines = [`Bạn cần: ${summary}.`];
  lines.push(
    relaxed
      ? `Chưa có con nào khớp đủ cả 4 ý nên mình nới phần ${relaxed}. Gần nhất là:`
      : `Mình gợi ý ${picks.length} con hợp nhất:`,
  );
  lines.push(...picks.map((item) => describePick(item, showAttribute)));
  if (extras.length > 0) {
    lines.push(
      `Gần đúng (${EXTRA_NOTES[extrasRelaxed] ?? 'gần với ý bạn'}), bạn xem thêm:`,
      ...extras.map((item) => describePick(item, showAttribute || extrasRelaxed === 'hệ')),
    );
  }
  lines.push(WHY[answers.purpose ?? 'unsure']);
  const shown = [...picks, ...extras];
  if (shown.some((item) => !item.onSale)) {
    lines.push('Con nào ghi "mở bán …" thì tới giờ đó mới thêm vào giỏ được nhé.');
  }
  lines.push('Bấm vào từng con bên dưới để xem ảnh và thêm vào giỏ.');

  return {
    reply: lines.join('\n'),
    links: [...shown.map(itemLink), browse],
    quickReplies: ['Tư vấn lại từ đầu', 'Cách đặt mua', 'Giải thích các hệ'],
    handoff: false,
    source: 'rules',
  };
}

/* ---------------- Điểm vào ---------------- */

export type ConsultOutcome =
  /** Không liên quan tới tư vấn */
  | { kind: 'none' }
  /** Bỏ phiên tư vấn đang dở, để bot trả lời câu này như bình thường */
  | { kind: 'exit' }
  /** `next` null nghĩa là phiên tư vấn đã xong / dừng */
  | { kind: 'reply'; reply: BotReply; next: ConsultState | null };

function mentionsItemName(text: string, knowledge: BotKnowledge): boolean {
  const words = new Set(text.split(' '));
  return knowledge.items.some((item) => {
    const species = normalizeText(item.name.replace(/^Bakugan\s+/i, '')).split(' ')[0] ?? '';
    return species.length >= 4 && words.has(species);
  });
}

/** Khách đang nhờ chọn Bakugan (chứ không hỏi một con cụ thể hay việc khác). */
export function isConsultRequest(message: string, knowledge: BotKnowledge): boolean {
  const text = normalizeText(message);
  if (text === normalizeText(CONSULT_STARTER)) return true;
  if (!hasAnyPhrase(text, START_PHRASES) || hasAnyPhrase(text, OTHER_TOPICS)) return false;
  if (/\bbk ?\d{1,4}\b/.test(text)) return false;
  return !mentionsItemName(text, knowledge);
}

function isExit(text: string): boolean {
  return EXIT_MESSAGES.has(text) || hasAnyPhrase(text, EXIT_PHRASES);
}

function advance(
  answers: ConsultAnswers,
  knowledge: BotKnowledge,
  startedAt: string,
  intro = '',
): ConsultOutcome {
  const step = nextStep(answers);
  if (!step) return { kind: 'reply' as const, reply: result(answers, knowledge), next: null };
  return {
    kind: 'reply' as const,
    reply: ask(step, answers, knowledge, intro),
    next: { step, answers, startedAt },
  };
}

export function runConsult(input: {
  message: string;
  state?: ConsultState;
  knowledge: BotKnowledge;
  /** Admin có bật việc tư vấn hàng cho bot không */
  enabled: boolean;
  now?: number;
}): ConsultOutcome {
  const { knowledge, enabled } = input;
  const now = input.now ?? Date.now();
  const text = normalizeText(input.message);

  if (isConsultRequest(input.message, knowledge)) {
    if (!enabled) {
      return {
        kind: 'reply',
        reply: {
          reply:
            'Phần tư vấn chọn Bakugan đang do nhân viên phụ trách, mình chuyển nhân viên tư vấn cho bạn ngay nhé.',
          handoff: true,
          source: 'rules',
        },
        next: null,
      };
    }
    if (knowledge.items.length === 0) return { kind: 'reply', reply: soldOutReply(), next: null };
    // Hiểu luôn những ý khách đã nói trong lời nhờ tư vấn.
    const answers: ConsultAnswers = STEPS.reduce<ConsultAnswers>(
      (acc, step) => ({ ...acc, ...parseAnswer(step, text, 'strict') }),
      {},
    );
    const known = understood(answers);
    return advance(
      answers,
      knowledge,
      new Date(now).toISOString(),
      `Mình giúp bạn chọn Bakugan qua vài câu hỏi ngắn nhé — bấm nút bên dưới để trả lời, muốn dừng thì nhắn "thôi".${known ? ` Mình ghi nhận: ${known}.` : ''}\n`,
    );
  }

  const state = input.state;
  if (!state) return { kind: 'none' };
  if (!enabled || now - new Date(state.startedAt).getTime() > CONSULT_TTL_MS) {
    return { kind: 'exit' };
  }

  if (isExit(text)) {
    return {
      kind: 'reply',
      reply: {
        reply:
          'Dạ, mình dừng phần tư vấn. Khi cần bạn nhắn "tư vấn" để mình hỏi lại từ đầu nhé. Bạn cần gì khác cứ hỏi mình!',
        handoff: false,
        source: 'rules',
      },
      next: null,
    };
  }

  const parsed = parseAnswer(state.step, text, 'answer');
  if (!parsed) {
    // Khách trả lời trước câu khác ("cũ cũng được" khi đang hỏi mục đích) -> ghi nhận luôn.
    const aside = STEPS.filter((step) => step !== state.step).reduce<ConsultAnswers>(
      (acc, step) =>
        isAnswered(state.answers, step) ? acc : { ...acc, ...parseAnswer(step, text, 'aside') },
      {},
    );
    const noted = understood(aside);
    if (noted) {
      return advance(
        { ...state.answers, ...aside },
        knowledge,
        state.startedAt,
        `Mình ghi nhận: ${noted}.\n`,
      );
    }
    // Câu dài / câu hỏi hẳn hoi -> khách đang hỏi việc khác; hoặc đã hỏi lại một lần rồi.
    const wordCount = text.split(' ').filter(Boolean).length;
    if ((state.retries ?? 0) >= 1 || input.message.includes('?') || wordCount >= 6) {
      return { kind: 'exit' };
    }
    return {
      kind: 'reply',
      reply: ask(
        state.step,
        state.answers,
        knowledge,
        'Mình chưa hiểu ý bạn lắm — bạn bấm chọn một nút bên dưới giúp mình nhé.\n',
      ),
      next: { ...state, retries: (state.retries ?? 0) + 1 },
    };
  }

  return advance({ ...state.answers, ...parsed }, knowledge, state.startedAt);
}

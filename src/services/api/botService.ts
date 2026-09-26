import type { BotFallbackReason, BotReply, BotRequest, BotTopicId } from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { answerWithRules } from '@/features/chat/ruleBot';
import { knowledgeToFacts, type BotKnowledge } from '@/features/chat/botKnowledge';

/**
 * Endpoint serverless giữ GEMINI_API_KEY (xem api/chat-bot.ts). Luôn cùng
 * domain với trang web, không đi qua VITE_API_BASE_URL của backend.
 */
const BOT_ENDPOINT = '/api/chat-bot';
const TIMEOUT_MS = 20_000;

const KNOWN_REASONS: readonly BotFallbackReason[] = [
  'not-configured',
  'invalid-key',
  'key-forbidden',
  'model-not-found',
  'quota-exceeded',
  'rate-limited',
  'upstream-down',
  'timeout',
  'empty-reply',
  'bad-request',
  'unreachable',
];

interface EndpointReply {
  reply?: unknown;
  handoff?: unknown;
  model?: unknown;
  error?: unknown;
}

type GeminiResult =
  | { ok: true; reply: string; handoff: boolean; model?: string }
  | { ok: false; reason: BotFallbackReason; model?: string };

/*
 * Lỗi cấu hình (chưa có khoá, khoá sai…) không tự hết trong vài giây: tạm không gọi
 * lại endpoint một lúc để bot trả lời ngay bằng bộ quy tắc, khỏi chờ một lượt mạng hỏng.
 * Nút "Kiểm tra kết nối" trong trang cài đặt xoá khoảng nghỉ này.
 */
const COOLDOWN_MS: Partial<Record<BotFallbackReason, number>> = {
  'not-configured': 5 * 60_000,
  'invalid-key': 5 * 60_000,
  'key-forbidden': 5 * 60_000,
  'quota-exceeded': 60_000,
  unreachable: 60_000,
};
let cooldown: { reason: BotFallbackReason; until: number } | null = null;

function isTopic(value: string): value is BotTopicId {
  return (BOT_TOPIC_IDS as readonly string[]).includes(value);
}

function toReason(value: unknown): BotFallbackReason {
  return KNOWN_REASONS.includes(value as BotFallbackReason)
    ? (value as BotFallbackReason)
    : 'upstream-down';
}

async function callGemini(request: BotRequest): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BOT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    let data: EndpointReply = {};
    try {
      data = (await response.json()) as EndpointReply;
    } catch {
      // Không phải JSON: thường là bản dev/preview không có endpoint này.
      return { ok: false, reason: 'unreachable' };
    }
    const model = typeof data.model === 'string' ? data.model : undefined;
    if (!response.ok) return { ok: false, reason: toReason(data.error), model };
    if (typeof data.reply !== 'string' || data.reply.trim() === '') {
      return { ok: false, reason: 'empty-reply', model };
    }
    return { ok: true, reply: data.reply.trim(), handoff: data.handoff === true, model };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'unreachable' };
  } finally {
    window.clearTimeout(timer);
  }
}

export interface AskBotInput {
  messages: BotRequest['messages'];
  topics: readonly string[];
  extraKnowledge: string;
  knowledge: BotKnowledge;
}

/** Hỏi Gemini; nếu không được thì trả lời bằng bộ quy tắc, kèm lý do để admin biết. */
export async function askBot(input: AskBotInput): Promise<BotReply> {
  const topics = input.topics.filter(isTopic);
  const request: BotRequest = {
    messages: input.messages.slice(-12),
    topics,
    extraKnowledge: input.extraKnowledge.slice(0, 1_500),
    facts: knowledgeToFacts(input.knowledge, topics),
  };

  const now = Date.now();
  const cooling = cooldown && cooldown.until > now ? cooldown : null;
  const result: GeminiResult = cooling
    ? { ok: false, reason: cooling.reason }
    : await callGemini(request);
  if (result.ok) {
    cooldown = null;
    return { reply: result.reply, handoff: result.handoff, source: 'gemini', model: result.model };
  }
  const wait = COOLDOWN_MS[result.reason];
  if (!cooling && wait) cooldown = { reason: result.reason, until: now + wait };

  const history = [...input.messages].reverse();
  const lastCustomerMessage = history.find((message) => message.role === 'customer')?.text ?? '';
  const previousBotReply = history.find((message) => message.role === 'assistant')?.text;
  return {
    ...answerWithRules(lastCustomerMessage, {
      topics,
      knowledge: input.knowledge,
      previousBotReply,
    }),
    fallbackReason: result.reason,
  };
}

/** Trang cài đặt: đã có khoá Gemini trên server chưa. */
export async function checkBotEndpoint(): Promise<{
  status: 'ready' | 'not-configured' | 'unreachable';
  model?: string;
}> {
  try {
    const response = await fetch(BOT_ENDPOINT, { method: 'GET' });
    if (!response.ok) return { status: 'unreachable' };
    const data = (await response.json()) as { configured?: unknown; model?: unknown };
    return {
      status: data.configured === true ? 'ready' : 'not-configured',
      model: typeof data.model === 'string' ? data.model : undefined,
    };
  } catch {
    return { status: 'unreachable' };
  }
}

/** Trang cài đặt: gửi thử một câu thật tới Gemini để chắc khoá và model dùng được. */
export async function testBotConnection(): Promise<GeminiResult> {
  cooldown = null;
  return callGemini({
    messages: [{ role: 'customer', text: 'Shop mở cửa mấy giờ?' }],
    topics: ['store-info'],
    extraKnowledge: '',
    facts: ['[Cửa hàng] TD Bakugan mở cửa 09:00 – 21:00 tất cả các ngày trong tuần.'],
  });
}

/** Giải thích lý do cho admin, kèm cách khắc phục. */
export const FALLBACK_REASON_TEXT: Record<BotFallbackReason, { title: string; fix: string }> = {
  'not-configured': {
    title: 'Chưa có GEMINI_API_KEY trên server',
    fix: 'Tạo khoá tại aistudio.google.com/apikey, thêm biến GEMINI_API_KEY trong Vercel (Settings → Environment Variables) rồi Redeploy.',
  },
  'invalid-key': {
    title: 'Khoá Gemini không hợp lệ',
    fix: 'Kiểm tra đã copy đủ khoá chưa (không thừa dấu cách), sửa lại biến GEMINI_API_KEY trên Vercel rồi Redeploy.',
  },
  'key-forbidden': {
    title: 'Google từ chối khoá này',
    fix: 'Khoá có thể đã bị khoá do lộ công khai hoặc bị giới hạn. Tạo khoá mới trong Google AI Studio và thay trên Vercel.',
  },
  'model-not-found': {
    title: 'Không tìm thấy model Gemini phù hợp',
    fix: 'Thêm biến GEMINI_MODEL trên Vercel với tên model có trong Google AI Studio (VD: gemini-2.5-flash) rồi Redeploy.',
  },
  'quota-exceeded': {
    title: 'Đã hết hạn mức miễn phí của Gemini',
    fix: 'Hạn mức sẽ tự hồi lại (theo phút / theo ngày). Trong lúc đó bot trả lời bằng bộ từ khoá.',
  },
  'rate-limited': {
    title: 'Gọi bot quá nhiều lần trong một phút',
    fix: 'Chờ khoảng một phút rồi thử lại.',
  },
  'upstream-down': {
    title: 'Máy chủ Gemini đang lỗi',
    fix: 'Thường tự hết sau ít phút. Trong lúc đó bot trả lời bằng bộ từ khoá.',
  },
  timeout: {
    title: 'Gemini trả lời quá chậm',
    fix: 'Thử lại sau; nếu lặp lại thường xuyên, đặt GEMINI_MODEL=gemini-2.5-flash.',
  },
  'empty-reply': {
    title: 'Gemini không trả về câu trả lời',
    fix: 'Thử lại; nếu lặp lại, đặt GEMINI_MODEL=gemini-2.5-flash trên Vercel.',
  },
  'bad-request': {
    title: 'Yêu cầu gửi tới Gemini bị từ chối',
    fix: 'Thử đặt GEMINI_MODEL=gemini-2.5-flash trên Vercel rồi Redeploy.',
  },
  unreachable: {
    title: 'Không gọi được /api/chat-bot',
    fix: 'Bản "vite preview" không chạy được endpoint này. Xem trên bản deploy Vercel, hoặc chạy "npm run dev" với GEMINI_API_KEY trong .env.local.',
  },
};

import type { BotReply, BotRequest, BotTopicId } from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { answerWithRules } from '@/features/chat/ruleBot';
import { knowledgeToFacts, type BotKnowledge } from '@/features/chat/botKnowledge';

/**
 * Endpoint serverless giữ GEMINI_API_KEY (xem api/chat-bot.ts). Luôn cùng
 * domain với trang web, không đi qua VITE_API_BASE_URL của backend.
 */
const BOT_ENDPOINT = '/api/chat-bot';
const TIMEOUT_MS = 20_000;

interface EndpointReply {
  reply?: unknown;
  handoff?: unknown;
}

function isTopic(value: string): value is BotTopicId {
  return (BOT_TOPIC_IDS as readonly string[]).includes(value);
}

async function callGemini(request: BotRequest): Promise<BotReply | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BOT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as EndpointReply;
    if (typeof data.reply !== 'string' || data.reply.trim() === '') return null;
    return { reply: data.reply.trim(), handoff: data.handoff === true, source: 'gemini' };
  } catch {
    // Mất mạng, quá thời gian, hoặc môi trường dev không có endpoint.
    return null;
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

/** Hỏi Gemini; nếu không được thì trả lời bằng bộ quy tắc từ khoá. */
export async function askBot(input: AskBotInput): Promise<BotReply> {
  const topics = input.topics.filter(isTopic);
  const request: BotRequest = {
    messages: input.messages.slice(-12),
    topics,
    extraKnowledge: input.extraKnowledge.slice(0, 1_500),
    facts: knowledgeToFacts(input.knowledge, topics),
  };

  const aiReply = await callGemini(request);
  if (aiReply) return aiReply;

  const lastCustomerMessage =
    [...input.messages].reverse().find((message) => message.role === 'customer')?.text ?? '';
  return answerWithRules(lastCustomerMessage, topics, input.knowledge);
}

/** Dùng ở trang cài đặt: kiểm tra endpoint có khoá Gemini hay chưa. */
export async function checkBotEndpoint(): Promise<'ready' | 'not-configured' | 'unreachable'> {
  try {
    const response = await fetch(BOT_ENDPOINT, { method: 'GET' });
    if (!response.ok) return 'unreachable';
    const data = (await response.json()) as { configured?: unknown };
    return data.configured === true ? 'ready' : 'not-configured';
  } catch {
    return 'unreachable';
  }
}

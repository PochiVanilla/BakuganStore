import type { BotSettings, ChatConversation, ChatMessage } from '@/types';
import { createId } from '@/mocks/db';
import { MockApiError } from './client';

/* Tiện ích dùng chung cho phần chat và lượt trả lời của bot (chế độ mock). */

export const MAX_MESSAGE_LENGTH = 1_000;

export function message(
  sender: ChatMessage['sender'],
  text: string,
  authorName?: string,
  extra: Pick<ChatMessage, 'quickReplies' | 'links'> = {},
): ChatMessage {
  return {
    id: createId('msg'),
    sender,
    text,
    createdAt: new Date().toISOString(),
    authorName,
    ...(extra.quickReplies?.length ? { quickReplies: extra.quickReplies.slice(0, 8) } : {}),
    ...(extra.links?.length ? { links: extra.links.slice(0, 6) } : {}),
  };
}

export function cleanText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new MockApiError('Tin nhắn trống.', 422);
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new MockApiError(`Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`, 422);
  }
  return trimmed;
}

export function botIsActive(settings: BotSettings, conversation: ChatConversation): boolean {
  return settings.enabled && conversation.botEnabled;
}

/** Bot trả lời khi đang tự hỗ trợ, và cả lúc khách đang chờ nhân viên (câu đơn giản). */
export function botMayReply(conversation: ChatConversation): boolean {
  return conversation.status === 'bot' || conversation.status === 'waiting';
}

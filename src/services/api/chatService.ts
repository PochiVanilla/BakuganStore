import type {
  ApiResponse,
  BotReply,
  BotSettings,
  ChatConversation,
  ChatMessage,
  ConversationStatus,
} from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { MOCK_COUPONS } from '@/mocks';
import { createId, hydrateOrder, listAllProducts, readDb, updateDb } from '@/mocks/db';
import { buildKnowledge } from '@/features/chat/botKnowledge';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { requireAdmin } from './mockSession';
import { askBot } from './botService';

/* ============================================================
   Chat khách ↔ shop.

   Chế độ mock: trình duyệt tự điều phối lượt trả lời của bot (gọi
   endpoint Gemini rồi ghi kết quả). Khi có backend thật, backend làm
   việc này ngay sau khi nhận tin của khách và đẩy về qua WebSocket.
   ============================================================ */

const MAX_MESSAGE_LENGTH = 1_000;

function message(sender: ChatMessage['sender'], text: string, authorName?: string): ChatMessage {
  return {
    id: createId('msg'),
    sender,
    text,
    createdAt: new Date().toISOString(),
    authorName,
  };
}

function cleanText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new MockApiError('Tin nhắn trống.', 422);
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new MockApiError(`Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`, 422);
  }
  return trimmed;
}

function botIsActive(settings: BotSettings, conversation: ChatConversation): boolean {
  return settings.enabled && conversation.botEnabled;
}

/* ---------------- Phía khách ---------------- */

/** Thông tin công khai của trợ lý để hiện ở khung chat. */
export interface ChatWidgetConfig {
  botEnabled: boolean;
  greeting: string;
}

export async function fetchWidgetConfig(): Promise<ChatWidgetConfig> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ChatWidgetConfig>>('/chat/config');
    return data.data;
  }
  const { enabled, greeting } = readDb().botSettings;
  return mockDelay({ botEnabled: enabled, greeting }, 80);
}

export async function fetchConversation(conversationId: string): Promise<ChatConversation | null> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ChatConversation | null>>(
      `/chat/conversations/${conversationId}`,
    );
    return data.data;
  }
  return mockDelay(readDb().conversations.find((item) => item.id === conversationId) ?? null, 80);
}

/** Cuộc trò chuyện gần nhất của khách đã đăng nhập (nếu có). */
export async function findConversationOf(customerId: string): Promise<ChatConversation | null> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ChatConversation | null>>(
      '/chat/conversations/mine',
    );
    return data.data;
  }
  const latest = readDb()
    .conversations.filter((item) => item.customerId === customerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return mockDelay(latest ?? null, 80);
}

export interface StartConversationInput {
  customerId?: string;
  customerName: string;
  customerContact?: string;
}

export async function startConversation(input: StartConversationInput): Promise<ChatConversation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<ChatConversation>>(
      '/chat/conversations',
      input,
    );
    return data.data;
  }
  const settings = readDb().botSettings;
  const now = new Date().toISOString();
  const conversation: ChatConversation = {
    id: createId('cvs'),
    customerId: input.customerId,
    customerName: input.customerName.trim().slice(0, 60) || 'Khách',
    customerContact: input.customerContact?.trim().slice(0, 80) || undefined,
    status: settings.enabled ? 'bot' : 'waiting',
    botEnabled: true,
    createdAt: now,
    updatedAt: now,
    unreadByAdmin: 0,
    unreadByCustomer: 0,
    messages: [
      settings.enabled
        ? message('bot', settings.greeting)
        : message(
            'system',
            'Chào bạn! Nhân viên TD Bakugan sẽ trả lời trong giờ làm việc 09:00–21:00.',
          ),
    ],
  };
  updateDb((db) => {
    db.conversations.unshift(conversation);
  });
  return mockDelay(conversation, 150);
}

export interface SendResult {
  conversation: ChatConversation;
  /** Bot sẽ trả lời tin này — giao diện hiện "đang soạn…" rồi gọi requestBotReply */
  awaitingBot: boolean;
}

export async function sendCustomerMessage(
  conversationId: string,
  text: string,
): Promise<SendResult> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<SendResult>>(
      `/chat/conversations/${conversationId}/messages`,
      { text },
    );
    return data.data;
  }
  const body = cleanText(text);
  const settings = readDb().botSettings;

  const conversation = updateDb((db) => {
    const target = db.conversations.find((item) => item.id === conversationId);
    if (!target) throw new MockApiError('Cuộc trò chuyện không còn tồn tại.', 404);
    // Khách nhắn tiếp sau khi đã xong -> mở lại, bot tiếp nhận trước nếu đang bật.
    if (target.status === 'resolved') {
      target.status = botIsActive(settings, target) ? 'bot' : 'waiting';
    }
    // Admin vừa tắt bot toàn shop -> tin mới chuyển thẳng cho nhân viên.
    if (target.status === 'bot' && !botIsActive(settings, target)) target.status = 'waiting';
    target.messages.push(message('customer', body));
    target.updatedAt = new Date().toISOString();
    if (target.status !== 'bot') target.unreadByAdmin += 1;
    return target;
  });

  return mockDelay(
    {
      conversation,
      awaitingBot: conversation.status === 'bot' && botIsActive(settings, conversation),
    },
    120,
  );
}

/** Lượt trả lời của bot cho tin nhắn mới nhất của khách. */
export async function requestBotReply(
  conversationId: string,
): Promise<{ conversation: ChatConversation; reply: BotReply | null }> {
  if (!USE_MOCK) {
    // Backend thật tự gọi bot khi nhận tin; ở đây chỉ lấy lại trạng thái mới nhất.
    const conversation = await fetchConversation(conversationId);
    if (!conversation) throw new MockApiError('Cuộc trò chuyện không còn tồn tại.', 404);
    return { conversation, reply: null };
  }

  const db = readDb();
  const current = db.conversations.find((item) => item.id === conversationId);
  if (!current) throw new MockApiError('Cuộc trò chuyện không còn tồn tại.', 404);
  const settings = db.botSettings;
  if (current.status !== 'bot' || !botIsActive(settings, current)) {
    return { conversation: current, reply: null };
  }

  const customer = current.customerId
    ? db.users.find((user) => user.id === current.customerId)
    : undefined;
  const products = listAllProducts(db);
  const knowledge = buildKnowledge({
    customerName: customer?.fullName ?? current.customerName,
    products,
    orders: current.customerId
      ? db.orders
          .filter((order) => order.userId === current.customerId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((order) => hydrateOrder(order, products))
      : [],
    coupons: MOCK_COUPONS,
  });

  const topics = BOT_TOPIC_IDS.filter((topic) => settings.topics[topic]);
  const botReply = await askBot({
    messages: current.messages
      .filter((item) => item.sender !== 'system')
      .map((item) => ({
        role: item.sender === 'customer' ? ('customer' as const) : ('assistant' as const),
        text: item.text,
      })),
    topics,
    extraKnowledge: settings.extraKnowledge,
    knowledge,
  });

  const conversation = updateDb((draft) => {
    const target = draft.conversations.find((item) => item.id === conversationId);
    if (!target) throw new MockApiError('Cuộc trò chuyện không còn tồn tại.', 404);
    // Trong lúc chờ AI, nhân viên có thể đã nhận cuộc trò chuyện -> bỏ câu của bot.
    if (target.status !== 'bot') return target;
    target.messages.push(message('bot', botReply.reply));
    if (botReply.handoff) {
      target.status = 'waiting';
      target.unreadByAdmin += 1;
      target.messages.push(message('system', draft.botSettings.handoffMessage));
    }
    target.unreadByCustomer += 1;
    target.updatedAt = new Date().toISOString();
    return target;
  });

  return { conversation, reply: botReply };
}

/** Khách bấm "Gặp nhân viên". */
export async function requestHuman(conversationId: string): Promise<ChatConversation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<ChatConversation>>(
      `/chat/conversations/${conversationId}/handoff`,
    );
    return data.data;
  }
  const conversation = updateDb((db) => {
    const target = db.conversations.find((item) => item.id === conversationId);
    if (!target) throw new MockApiError('Cuộc trò chuyện không còn tồn tại.', 404);
    if (target.status === 'waiting' || target.status === 'admin') return target;
    target.status = 'waiting';
    target.unreadByAdmin += 1;
    target.messages.push(message('system', db.botSettings.handoffMessage));
    target.updatedAt = new Date().toISOString();
    return target;
  });
  return mockDelay(conversation, 150);
}

export async function markReadByCustomer(conversationId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.post(`/chat/conversations/${conversationId}/read`);
    return;
  }
  const target = readDb().conversations.find((item) => item.id === conversationId);
  if (!target || target.unreadByCustomer === 0) return;
  updateDb((db) => {
    const draft = db.conversations.find((item) => item.id === conversationId);
    if (draft) draft.unreadByCustomer = 0;
  });
}

/* ---------------- Phía admin ---------------- */

export type ConversationFilter = ConversationStatus | 'all' | 'needs-reply';

export async function listConversations(
  filter: ConversationFilter = 'all',
): Promise<ChatConversation[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ChatConversation[]>>(
      '/admin/chat/conversations',
      { params: { filter } },
    );
    return data.data;
  }
  requireAdmin();
  const rows = readDb()
    .conversations.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'needs-reply') {
        return item.status === 'waiting' || (item.status === 'admin' && item.unreadByAdmin > 0);
      }
      return item.status === filter;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return mockDelay(rows, 120);
}

function adminUpdate(
  conversationId: string,
  mutate: (conversation: ChatConversation, adminName: string) => void,
): ChatConversation {
  const admin = requireAdmin();
  return updateDb((db) => {
    const target = db.conversations.find((item) => item.id === conversationId);
    if (!target) throw new MockApiError('Không tìm thấy cuộc trò chuyện.', 404);
    mutate(target, admin.fullName);
    return target;
  });
}

export async function sendAdminMessage(
  conversationId: string,
  text: string,
): Promise<ChatConversation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<ChatConversation>>(
      `/admin/chat/conversations/${conversationId}/messages`,
      { text },
    );
    return data.data;
  }
  const body = cleanText(text);
  const conversation = adminUpdate(conversationId, (target, adminName) => {
    // Nhân viên đã vào thì bot nhường lời.
    target.status = 'admin';
    target.messages.push(message('admin', body, adminName));
    target.unreadByAdmin = 0;
    target.unreadByCustomer += 1;
    target.updatedAt = new Date().toISOString();
  });
  return mockDelay(conversation, 150);
}

/** Bật/tắt bot cho riêng cuộc này. Bật lại nghĩa là trả cuộc trò chuyện cho bot. */
export async function setConversationBot(
  conversationId: string,
  enabled: boolean,
): Promise<ChatConversation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<ChatConversation>>(
      `/admin/chat/conversations/${conversationId}`,
      { botEnabled: enabled },
    );
    return data.data;
  }
  const conversation = adminUpdate(conversationId, (target) => {
    target.botEnabled = enabled;
    if (enabled && target.status !== 'resolved') {
      target.status = 'bot';
      target.messages.push(message('system', 'Trợ lý AI tiếp tục hỗ trợ bạn.'));
    }
    if (!enabled && target.status === 'bot') target.status = 'admin';
    target.updatedAt = new Date().toISOString();
  });
  return mockDelay(conversation, 150);
}

export async function resolveConversation(conversationId: string): Promise<ChatConversation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<ChatConversation>>(
      `/admin/chat/conversations/${conversationId}/resolve`,
    );
    return data.data;
  }
  const conversation = adminUpdate(conversationId, (target) => {
    target.status = 'resolved';
    target.unreadByAdmin = 0;
    target.messages.push(
      message('system', 'Cuộc trò chuyện đã hoàn tất. Bạn nhắn tiếp bất cứ lúc nào nhé!'),
    );
    target.updatedAt = new Date().toISOString();
  });
  return mockDelay(conversation, 150);
}

export async function markReadByAdmin(conversationId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.post(`/admin/chat/conversations/${conversationId}/read`);
    return;
  }
  requireAdmin();
  const target = readDb().conversations.find((item) => item.id === conversationId);
  if (!target || target.unreadByAdmin === 0) return;
  updateDb((db) => {
    const draft = db.conversations.find((item) => item.id === conversationId);
    if (draft) draft.unreadByAdmin = 0;
  });
}

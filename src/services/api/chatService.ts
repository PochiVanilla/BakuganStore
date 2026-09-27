import type {
  ApiResponse,
  BotReply,
  BotSettings,
  BotTopicId,
  ChatConversation,
  ChatMessage,
  ConsultState,
  ConversationStatus,
  PendingBotAction,
} from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { MOCK_COUPONS } from '@/mocks';
import {
  createId,
  hydrateOrder,
  listFeedPosts,
  readDb,
  updateDb,
  type MockDatabase,
} from '@/mocks/db';
import { DEFAULT_BOT_SETTINGS } from '@/mocks/seed';
import {
  buildKnowledge,
  linksFromText,
  type BotKnowledge,
  type BotMembershipFact,
} from '@/features/chat/botKnowledge';
import { decideBotAction, isCancellable } from '@/features/chat/botActions';
import { runConsult } from '@/features/chat/consultFlow';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { requireAdmin } from './mockSession';
import { askBot } from './botService';
import { membershipInfoOf } from './membershipRules';
import { recordStatus, releaseCancelledOrder } from './orderMutations';

/* ============================================================
   Chat khách ↔ shop.

   Chế độ mock: trình duyệt tự điều phối lượt trả lời của bot (gọi
   endpoint Gemini rồi ghi kết quả). Khi có backend thật, backend làm
   việc này ngay sau khi nhận tin của khách và đẩy về qua WebSocket.
   ============================================================ */

const MAX_MESSAGE_LENGTH = 1_000;

function message(
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

/** Bot trả lời khi đang tự hỗ trợ, và cả lúc khách đang chờ nhân viên (câu đơn giản). */
function botMayReply(conversation: ChatConversation): boolean {
  return conversation.status === 'bot' || conversation.status === 'waiting';
}

/** Việc admin cho phép; cài đặt lưu từ bản cũ thiếu việc mới thì lấy mặc định. */
function enabledTopics(settings: BotSettings): BotTopicId[] {
  return BOT_TOPIC_IDS.filter(
    (topic) => settings.topics[topic] ?? DEFAULT_BOT_SETTINGS.topics[topic],
  );
}

function membershipFactOf(db: Readonly<MockDatabase>, customerId?: string): BotMembershipFact {
  const base: BotMembershipFact = {
    depositAmount: db.shopSettings.memberDepositAmount,
    bankConfigured: Boolean(db.shopSettings.bank.accountNumber.trim()),
  };
  const customer = customerId ? db.users.find((user) => user.id === customerId) : undefined;
  if (!customer || customer.role !== 'customer') return base;
  const info = membershipInfoOf(db, customer);
  return {
    ...base,
    level: info.level,
    purchasedCount: info.purchasedCount,
    pendingRequest: info.pendingRequest?.kind,
  };
}

/** Những gì bot được biết khi trả lời cuộc trò chuyện này (đơn chỉ của chính khách). */
function knowledgeFor(
  db: Readonly<MockDatabase>,
  conversation: Pick<ChatConversation, 'customerId' | 'customerName'>,
): BotKnowledge {
  const orders = conversation.customerId
    ? db.orders
        .filter((order) => order.userId === conversation.customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  return buildKnowledge({
    customerName: conversation.customerName,
    isSignedIn: Boolean(conversation.customerId),
    feeds: listFeedPosts(db),
    orders: orders.map((order) => hydrateOrder(order, db)),
    coupons: MOCK_COUPONS,
    membership: membershipFactOf(db, conversation.customerId),
  });
}

/** Trang cài đặt (ô "Thử bot"): dữ liệu bot thấy khi một khách vãng lai hỏi. */
export async function previewBotKnowledge(): Promise<BotKnowledge> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BotKnowledge>>('/admin/chat/bot-knowledge');
    return data.data;
  }
  requireAdmin();
  return mockDelay(knowledgeFor(readDb(), { customerName: 'Khách thử nghiệm' }), 120);
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
      awaitingBot: botMayReply(conversation) && botIsActive(settings, conversation),
    },
    120,
  );
}

/**
 * Lượt trả lời của bot cho tin nhắn mới nhất của khách:
 * 1. Việc bot được tự làm (huỷ đơn, xác nhận huỷ) — xử lý bằng luật cố định.
 * 2. Tư vấn chọn Bakugan: hỏi từng câu rồi gợi ý con phù hợp — luật cố định.
 * 3. Còn lại hỏi Gemini; không được thì bộ trả lời theo từ khoá.
 *
 * Khi có backend thật, backend chạy đúng các bước này và phải lấy danh tính
 * khách từ token đăng nhập — không tin `customerId` do trình duyệt gửi lên.
 */
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
  const lastCustomerMessage = [...current.messages]
    .reverse()
    .find((item) => item.sender === 'customer');
  if (!botMayReply(current) || !botIsActive(settings, current) || !lastCustomerMessage) {
    return { conversation: current, reply: null };
  }

  const topics = enabledTopics(settings);
  const knowledge = knowledgeFor(db, current);
  const customerOrders = current.customerId
    ? db.orders
        .filter((order) => order.userId === current.customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const decision = decideBotAction({
    message: lastCustomerMessage.text,
    pendingAction: current.pendingAction,
    isSignedIn: Boolean(current.customerId),
    cancelEnabled: topics.includes('order-cancel'),
    orders: customerOrders.map((order) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      itemCount: order.items.length,
    })),
  });

  let botReply: BotReply | null = null;
  /** undefined = giữ nguyên, null = xoá, còn lại = đặt mới */
  let nextPending: PendingBotAction | null | undefined;
  let nextConsult: ConsultState | null | undefined;
  if (decision.kind === 'reply') {
    botReply = { reply: decision.reply, handoff: decision.handoff, source: 'action' };
    nextPending = decision.pendingAction;
    // Khách chuyển sang việc huỷ đơn -> bỏ phần tư vấn đang dở.
    if (current.consult) nextConsult = null;
  } else if (decision.kind === 'none') {
    nextPending = decision.clearPending ? null : undefined;
    const consult = runConsult({
      message: lastCustomerMessage.text,
      state: current.consult,
      knowledge,
      enabled: topics.includes('product-info'),
    });
    if (consult.kind === 'reply') {
      botReply = consult.reply;
      nextConsult = consult.next;
    } else {
      if (consult.kind === 'exit') nextConsult = null;
      botReply = await askBot({
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
      // Câu trả lời có nhắc mã BK / feed nào thì gắn nút mở đúng chỗ đó.
      if (!botReply.links?.length) {
        const links = linksFromText(botReply.reply, knowledge);
        if (links.length > 0) botReply = { ...botReply, links };
      }
    }
  } else {
    nextPending = null;
    if (current.consult) nextConsult = null;
  }

  let finalReply: BotReply | null = botReply;
  const conversation = updateDb((draft) => {
    const target = draft.conversations.find((item) => item.id === conversationId);
    if (!target) throw new MockApiError('Cuộc trò chuyện không còn tồn tại.', 404);
    // Trong lúc bot xử lý, nhân viên có thể đã nhận cuộc trò chuyện -> bot nhường lời.
    if (!botMayReply(target)) {
      finalReply = null;
      return target;
    }
    const now = new Date().toISOString();

    if (decision.kind === 'execute-cancel') {
      // Kiểm tra lại ngay lúc huỷ: lời xác nhận vẫn còn, đúng chủ đơn, đơn vẫn chờ
      // xác nhận và chưa trả tiền.
      const order = draft.orders.find((item) => item.id === decision.orderId);
      if (
        order &&
        target.pendingAction?.orderId === order.id &&
        target.customerId &&
        order.userId === target.customerId &&
        isCancellable(order)
      ) {
        releaseCancelledOrder(draft, order, 'customer-request', 'Khách tự huỷ qua chat.', now);
        recordStatus(
          order,
          'cancelled',
          'Trợ lý AI (khách yêu cầu)',
          now,
          'Khách tự huỷ qua chat.',
        );
        finalReply = {
          reply: `Mình đã huỷ đơn #${order.code} theo yêu cầu của bạn. Các con Bakugan trong đơn đã được mở bán lại — muốn mua lại thì bạn nhanh tay thêm vào giỏ nhé!`,
          handoff: false,
          source: 'action',
        };
      } else {
        finalReply = {
          reply: `Đơn #${decision.orderCode} vừa được shop xử lý nên mình không huỷ được nữa. Mình chuyển nhân viên hỗ trợ bạn nhé.`,
          handoff: true,
          source: 'action',
        };
      }
    }

    if (nextPending === null) delete target.pendingAction;
    else if (nextPending) target.pendingAction = nextPending;
    if (nextConsult === null) delete target.consult;
    else if (nextConsult) target.consult = nextConsult;

    if (!finalReply) return target;
    target.messages.push(
      message('bot', finalReply.reply, undefined, {
        quickReplies: finalReply.quickReplies,
        links: finalReply.links,
      }),
    );
    // Chỉ báo "đã chuyển nhân viên" một lần; đang chờ sẵn thì không nhắc lại.
    if (finalReply.handoff && target.status === 'bot') {
      target.status = 'waiting';
      target.unreadByAdmin += 1;
      target.messages.push(message('system', draft.botSettings.handoffMessage));
    }
    target.unreadByCustomer += 1;
    target.updatedAt = now;
    return target;
  });

  return { conversation, reply: finalReply };
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
    // Xong việc thì bỏ luôn phần tư vấn / lời xác nhận huỷ đang dở.
    delete target.consult;
    delete target.pendingAction;
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

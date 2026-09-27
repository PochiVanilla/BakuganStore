import type {
  BotReply,
  BotSettings,
  BotTopicId,
  ChatConversation,
  ConsultState,
  PendingBotAction,
} from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { MOCK_COUPONS } from '@/mocks';
import { hydrateOrder, listFeedPosts, readDb, updateDb, type MockDatabase } from '@/mocks/db';
import { DEFAULT_BOT_SETTINGS } from '@/mocks/seed';
import {
  buildKnowledge,
  linksFromText,
  type BotKnowledge,
  type BotMembershipFact,
} from '@/features/chat/botKnowledge';
import { decideBotAction, isCancellable } from '@/features/chat/botActions';
import { runConsult } from '@/features/chat/consultFlow';
import { MockApiError } from './client';
import { askBot } from './botService';
import { membershipInfoOf } from './membershipRules';
import { recordStatus, releaseCancelledOrder } from './orderMutations';
import { botIsActive, botMayReply, message } from './chatShared';

/* ============================================================
   Lượt trả lời của bot ở chế độ mock (luật cố định, tư vấn chọn
   Bakugan, Gemini, bộ trả lời theo từ khoá).

   Tách riêng để chỉ tải khi khách thật sự nhắn tin — khung chat
   đóng thì trang không phải tải phần này.
   ============================================================ */

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
export function knowledgeFor(
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
    checkout: {
      cardPayments: db.shopSettings.cardPayments,
      international: db.shopSettings.cardPayments && db.shopSettings.international.enabled,
      feeAsia: db.shopSettings.international.feeAsia,
      feeWorld: db.shopSettings.international.feeWorld,
    },
  });
}

export async function runBotTurn(
  conversationId: string,
): Promise<{ conversation: ChatConversation; reply: BotReply | null }> {
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

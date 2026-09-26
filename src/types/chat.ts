/* ============================================================
   Chat giữa khách và shop, có trợ lý AI trả lời các câu đơn giản
   ============================================================ */

export type ChatSender = 'customer' | 'bot' | 'admin' | 'system';

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  createdAt: string;
  /** Tên người gửi hiển thị (nhân viên nào trả lời) */
  authorName?: string;
}

/**
 * - `bot`      : trợ lý AI đang tự trả lời
 * - `waiting`  : đang chờ nhân viên nhận; trong lúc chờ bot vẫn trả lời câu đơn giản
 * - `admin`    : nhân viên đang trò chuyện trực tiếp
 * - `resolved` : đã xong; khách nhắn tiếp thì mở lại
 */
export type ConversationStatus = 'bot' | 'waiting' | 'admin' | 'resolved';

/**
 * Việc bot đang chờ khách xác nhận (VD: "Bạn chắc chắn huỷ đơn #X?").
 * Hết hạn sau vài phút để một chữ "ok" vu vơ về sau không huỷ nhầm đơn.
 */
export interface PendingBotAction {
  type: 'cancel-order';
  orderId: string;
  orderCode: string;
  expiresAt: string;
}

export interface ChatConversation {
  id: string;
  /** Khách chưa đăng nhập thì không có */
  customerId?: string;
  customerName: string;
  /** SĐT hoặc email khách để lại */
  customerContact?: string;
  status: ConversationStatus;
  /** Admin tắt bot cho riêng cuộc trò chuyện này khi muốn tự xử lý */
  botEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  unreadByAdmin: number;
  unreadByCustomer: number;
  messages: ChatMessage[];
  pendingAction?: PendingBotAction;
}

/* ---------- Trợ lý AI ---------- */

/** Những việc admin cho phép bot tự giải quyết. Mọi việc khác bot chuyển nhân viên. */
export const BOT_TOPIC_IDS = [
  'order-status',
  'order-cancel',
  'shipping',
  'payment',
  'returns',
  'auction-rules',
  'product-info',
  'bakugan-knowledge',
  'store-info',
  'promotions',
] as const;
export type BotTopicId = (typeof BOT_TOPIC_IDS)[number];

export interface BotSettings {
  enabled: boolean;
  greeting: string;
  topics: Record<BotTopicId, boolean>;
  /** Ghi chú admin muốn bot biết thêm (khuyến mãi tuần này, lịch nghỉ lễ…) */
  extraKnowledge: string;
  handoffMessage: string;
  updatedAt: string;
}

/** Dữ liệu gửi lên endpoint bot. Mọi trường đều bị giới hạn độ dài ở server. */
export interface BotRequest {
  messages: Array<{ role: 'customer' | 'assistant'; text: string }>;
  topics: BotTopicId[];
  extraKnowledge: string;
  /** Các dòng dữ kiện: thông tin shop, sản phẩm, đơn của chính khách này */
  facts: string[];
}

/** Vì sao không dùng được Gemini (hiện cho admin ở trang cài đặt, khách không thấy). */
export type BotFallbackReason =
  | 'not-configured'
  | 'invalid-key'
  | 'key-forbidden'
  | 'model-not-found'
  | 'quota-exceeded'
  | 'rate-limited'
  | 'upstream-down'
  | 'timeout'
  | 'empty-reply'
  | 'bad-request'
  | 'unreachable';

export interface BotReply {
  reply: string;
  /** Bot tự thấy cần chuyển cho nhân viên */
  handoff: boolean;
  /** Nguồn câu trả lời: AI thật, bộ trả lời dự phòng, hay thao tác tự động (huỷ đơn…) */
  source: 'gemini' | 'rules' | 'action';
  /** Model Gemini đã trả lời */
  model?: string;
  /** Có khi source là 'rules': lý do không gọi được Gemini */
  fallbackReason?: BotFallbackReason;
}

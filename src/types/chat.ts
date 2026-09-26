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
 * - `waiting`  : bot đã chuyển, đang chờ nhân viên nhận
 * - `admin`    : nhân viên đang trò chuyện trực tiếp
 * - `resolved` : đã xong; khách nhắn tiếp thì mở lại
 */
export type ConversationStatus = 'bot' | 'waiting' | 'admin' | 'resolved';

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
}

/* ---------- Trợ lý AI ---------- */

/** Những việc admin cho phép bot tự giải quyết. Mọi việc khác bot chuyển nhân viên. */
export const BOT_TOPIC_IDS = [
  'order-status',
  'shipping',
  'payment',
  'returns',
  'auction-rules',
  'product-info',
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

export interface BotReply {
  reply: string;
  /** Bot tự thấy cần chuyển cho nhân viên */
  handoff: boolean;
  /** Nguồn câu trả lời: AI thật hay bộ trả lời dự phòng theo từ khoá */
  source: 'gemini' | 'rules';
}

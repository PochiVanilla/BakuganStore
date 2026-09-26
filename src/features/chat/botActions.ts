import type { OrderStatus, PaymentStatus, PendingBotAction } from '@/types';
import { formatCurrency } from '@/utils/format';
import {
  extractOrderCode,
  hasAnyPhrase,
  hasPhrase,
  normalizeText,
  stripOrderCode,
} from './textNormalize';

/* ============================================================
   Những việc bot được TỰ LÀM (không chỉ trả lời) — hiện có: huỷ đơn.

   Viết bằng luật cố định, không để AI quyết định, và luôn:
   - chỉ đụng tới đơn của chính khách đang đăng nhập,
   - chỉ huỷ đơn "Chờ xác nhận" và chưa thanh toán,
   - hỏi lại "đồng ý huỷ?" trước khi làm, lời xác nhận hết hạn sau 10 phút.
   Server kiểm tra lại các điều kiện này lúc thực hiện.
   ============================================================ */

export interface CancelCandidate {
  id: string;
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
}

export type BotActionDecision =
  /** Không phải việc cần làm — để phần hỏi đáp trả lời */
  | { kind: 'none'; clearPending: boolean }
  | { kind: 'reply'; reply: string; handoff: boolean; pendingAction: PendingBotAction | null }
  | { kind: 'execute-cancel'; orderId: string; orderCode: string };

const CONFIRM_TTL_MS = 10 * 60 * 1000;

const CANCEL_PHRASES = [
  'huy don',
  'huy dat hang',
  'huy don hang',
  'muon huy',
  'huy giup',
  'khong mua nua',
  'bo don',
  'khong lay nua',
];

/*
 * Trả lời câu "Bạn muốn huỷ đơn #X đúng không?". Chỉ tính là đồng ý / không đồng ý
 * khi cả câu chỉ gồm những từ dưới đây — câu có ý khác ("Shop có bán Dragonoid
 * không?") không bao giờ bị hiểu nhầm thành lời đồng ý huỷ.
 */
const CONFIRM_PHRASES: ReadonlyArray<readonly [string, 'affirm' | 'deny']> = [
  ['dung huy', 'deny'],
  ['de sau', 'deny'],
  ['dung roi', 'affirm'],
  ['dung vay', 'affirm'],
  ['dong y', 'affirm'],
  ['xac nhan', 'affirm'],
  ['chac chan', 'affirm'],
];
const AFFIRM_WORDS = new Set(['ok', 'co', 'vang', 'u', 'uh', 'um', 'uk', 'yes', 'duoc', 'huy']);
/** "nó" và "no" trùng nhau khi bỏ dấu — nghiêng về không huỷ cho an toàn. */
const DENY_WORDS = new Set(['khong', 'thoi', 'khoan', 'giu', 'chua', 'no']);
const FILLER_WORDS = new Set([
  'a',
  'ah',
  'ak',
  'da',
  'nhe',
  'nha',
  'nhen',
  'chu',
  'di',
  'luon',
  'giup',
  'gium',
  'dum',
  'minh',
  'toi',
  'em',
  'shop',
  'ban',
  'admin',
  'oi',
  'cho',
  'voi',
  'vay',
  'nay',
  'do',
  'nua',
  'lai',
  'can',
  'de',
  'don',
  'hang',
  'roi',
  'that',
  'cam',
  'on',
]);

/** Không đủ rõ để làm theo: "đúng" và "dừng" trùng nhau khi bỏ dấu, "dạ" có thể chỉ là "vâng, mình nghe". */
const UNCLEAR_WORDS = new Set(['', 'dung', 'ha', 'sao', 'gi', 'hm', 'hmm', 'uhm', ...FILLER_WORDS]);

/** "đồng ý", "ừ huỷ đi", "không huỷ nữa"… — undefined nếu câu không phải lời trả lời xác nhận. */
export function classifyConfirmation(normalized: string): 'affirm' | 'deny' | undefined {
  let rest = ` ${stripOrderCode(normalized)} `;
  let affirm = false;
  let deny = false;
  for (const [phrase, kind] of CONFIRM_PHRASES) {
    while (rest.includes(` ${phrase} `)) {
      rest = rest.replace(` ${phrase} `, ' ');
      if (kind === 'affirm') affirm = true;
      else deny = true;
    }
  }
  for (const word of rest.split(' ').filter(Boolean)) {
    if (DENY_WORDS.has(word)) deny = true;
    else if (AFFIRM_WORDS.has(word)) affirm = true;
    else if (!FILLER_WORDS.has(word)) return undefined;
  }
  // Vừa "không" vừa "có" -> coi là không, để không huỷ nhầm.
  if (deny) return 'deny';
  return affirm ? 'affirm' : undefined;
}

export function isCancelRequest(normalized: string): boolean {
  if (hasAnyPhrase(normalized, CANCEL_PHRASES)) return true;
  // "huỷ TD2609A17"
  return hasPhrase(normalized, 'huy') && Boolean(extractOrderCode(normalized));
}

export function isCancellable(order: Pick<CancelCandidate, 'status' | 'paymentStatus'>): boolean {
  return order.status === 'pending' && order.paymentStatus !== 'paid';
}

function reply(text: string, handoff: boolean, pendingAction: PendingBotAction | null = null) {
  return { kind: 'reply' as const, reply: text, handoff, pendingAction };
}

function askToConfirm(order: CancelCandidate, now: number): BotActionDecision {
  return reply(
    `Bạn muốn huỷ đơn #${order.code} (${order.itemCount} sản phẩm, tổng ${formatCurrency(order.total)}) đúng không? Nhắn "Đồng ý" để mình huỷ, hoặc "Không" để giữ đơn.`,
    false,
    {
      type: 'cancel-order',
      orderId: order.id,
      orderCode: order.code,
      expiresAt: new Date(now + CONFIRM_TTL_MS).toISOString(),
    },
  );
}

/** Đơn này có huỷ qua chat được không; không được thì giải thích vì sao. */
function explainOrConfirm(order: CancelCandidate, now: number): BotActionDecision {
  if (isCancellable(order)) return askToConfirm(order, now);
  const code = `#${order.code}`;
  switch (order.status) {
    case 'pending':
      return reply(
        `Đơn ${code} đã thanh toán nên cần nhân viên huỷ và hoàn tiền cho bạn. Mình chuyển nhân viên ngay nhé.`,
        true,
      );
    case 'confirmed':
    case 'packing':
      return reply(
        `Đơn ${code} đã được shop ${order.status === 'confirmed' ? 'xác nhận' : 'đóng gói'} nên cần nhân viên kiểm tra trước khi huỷ. Mình chuyển nhân viên ngay nhé.`,
        true,
      );
    case 'shipping':
      return reply(
        `Đơn ${code} đang được giao nên không huỷ qua chat được nữa. Bạn có thể từ chối nhận khi shipper tới, hoặc đổi trả trong 7 ngày nếu hàng lỗi. Mình chuyển nhân viên hỗ trợ thêm nhé.`,
        true,
      );
    case 'completed':
      return reply(
        `Đơn ${code} đã giao thành công nên không huỷ được nữa. Nếu hàng có lỗi, bạn được đổi trả trong 7 ngày — nhắn "đổi trả" để mình hướng dẫn nhé.`,
        false,
      );
    case 'cancelled':
      return reply(`Đơn ${code} đã được huỷ trước đó rồi ạ.`, false);
    case 'returned':
    default:
      return reply(`Đơn ${code} đã được hoàn trả rồi ạ.`, false);
  }
}

export interface BotActionInput {
  message: string;
  pendingAction?: PendingBotAction;
  isSignedIn: boolean;
  /** Admin có cho bot tự huỷ đơn không */
  cancelEnabled: boolean;
  /** Đơn của chính khách đang chat, mới nhất trước */
  orders: readonly CancelCandidate[];
  now?: number;
}

export function decideBotAction(input: BotActionInput): BotActionDecision {
  const text = normalizeText(input.message);
  const now = input.now ?? Date.now();
  const pending =
    input.pendingAction && new Date(input.pendingAction.expiresAt).getTime() > now
      ? input.pendingAction
      : undefined;

  // Khách đang trả lời câu "Bạn muốn huỷ đơn #X đúng không?"
  if (pending && input.cancelEnabled) {
    const code = extractOrderCode(text);
    if (!code || code === pending.orderCode) {
      const answer = classifyConfirmation(text);
      if (answer === 'deny') {
        return reply(`Dạ, mình giữ nguyên đơn #${pending.orderCode} cho bạn.`, false);
      }
      if (answer === 'affirm') {
        return { kind: 'execute-cancel', orderId: pending.orderId, orderCode: pending.orderCode };
      }
      // Trả lời chưa rõ ("dạ", "đúng/dừng", "hả", chỉ gửi emoji) -> hỏi lại, giữ lời xác nhận.
      if (
        stripOrderCode(text)
          .split(' ')
          .every((word) => UNCLEAR_WORDS.has(word))
      ) {
        return reply(
          `Bạn nhắn "Đồng ý" để mình huỷ đơn #${pending.orderCode}, hoặc "Không" để giữ đơn nhé.`,
          false,
          pending,
        );
      }
    }
  }

  const clearPending = Boolean(input.pendingAction);
  // Admin tắt việc này -> để phần hỏi đáp trả lời (sẽ chuyển nhân viên).
  if (!isCancelRequest(text) || !input.cancelEnabled) return { kind: 'none', clearPending };

  if (!input.isSignedIn) {
    return reply(
      'Bạn đăng nhập bằng tài khoản đã đặt hàng để mình kiểm tra và huỷ giúp nhé. Nếu bạn đặt hàng không qua tài khoản, bấm "Gặp nhân viên" để nhân viên hỗ trợ.',
      false,
    );
  }

  const code = extractOrderCode(text);
  if (code) {
    const order = input.orders.find((item) => item.code.toUpperCase() === code);
    return order
      ? explainOrConfirm(order, now)
      : reply(
          `Mình không thấy đơn #${code} trong tài khoản của bạn. Bạn kiểm tra lại mã đơn trong mục "Đơn hàng của tôi" giúp mình nhé.`,
          false,
        );
  }

  const cancellable = input.orders.filter(isCancellable);
  if (cancellable.length === 1) return askToConfirm(cancellable[0]!, now);
  if (cancellable.length > 1) {
    const list = cancellable
      .map((order) => `• #${order.code} — ${formatCurrency(order.total)}`)
      .join('\n');
    return reply(
      `Bạn có ${cancellable.length} đơn đang chờ xác nhận:\n${list}\nBạn muốn huỷ đơn nào? Nhắn "huỷ đơn" kèm mã đơn giúp mình nhé.`,
      false,
    );
  }

  const active = input.orders.find((order) =>
    ['pending', 'confirmed', 'packing', 'shipping'].includes(order.status),
  );
  if (active) return explainOrConfirm(active, now);
  return reply('Bạn không có đơn nào đang xử lý để huỷ ạ.', false);
}

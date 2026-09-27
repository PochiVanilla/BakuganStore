import type { ApiResponse, CardBrand, Order, PaymentMethod } from '@/types';
import { ROUTES } from '@/constants/routes';
import { describeCard, PAYMENT_METHOD_LABELS } from '@/constants/orders';
import { hydrateOrder, readDb, updateDb, type StoredOrder } from '@/mocks/db';
import { cardDigits, expiryValid, luhnValid } from '@/utils/card';
import { formatCurrency } from '@/utils/format';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { requireUser } from './mockSession';
import {
  cardHoldExpired,
  recordStatus,
  releaseCancelledOrder,
  sweepExpiredCardHolds,
} from './orderMutations';

/* ============================================================
   Thanh toán thẻ Visa / Mastercard / JCB qua cổng thanh toán.

   Luồng khi có backend:
   1. Khách đặt đơn trả bằng thẻ -> server giữ hàng 15 phút.
   2. POST /payments/card/sessions { orderId, returnUrl } -> server tạo phiên ở cổng
      (ký bằng khoá bí mật, số tiền lấy từ đơn trên server, không lấy từ trình duyệt)
      và trả về redirectUrl.
   3. Trình duyệt sang trang của cổng: khách nhập thẻ + xác thực 3-D Secure ở đó.
      Web của shop không bao giờ thấy hay lưu số thẻ.
   4. Cổng gọi IPN về server (kiểm tra chữ ký) -> đơn thành "Đã thanh toán", rồi đưa
      khách về /thanh-toan/ket-qua/:orderId. Trang đó hỏi lại server trạng thái đơn,
      không tin tham số trên URL.

   Chế độ mock: /thanh-toan/cong-the/:orderId là cổng giả lập, chỉ nhận thẻ thử.
   ============================================================ */

/* ---------------- Phía khách (web của shop) ---------------- */

function findOwnOrder(orderId: string): StoredOrder {
  const user = requireUser();
  const order = readDb().orders.find((item) => item.id === orderId);
  if (!order || order.userId !== user.id) {
    throw new MockApiError('Không tìm thấy đơn hàng này trong tài khoản của bạn.', 404);
  }
  return order;
}

/** Còn trả bằng thẻ được không — nếu không thì báo lý do. */
function assertPayable(order: StoredOrder, now: number = Date.now()): void {
  if (order.paymentMethod !== 'card') throw new MockApiError('Đơn này không trả bằng thẻ.', 409);
  if (order.paymentStatus === 'paid') {
    throw new MockApiError('Đơn này đã được thanh toán rồi.', 409);
  }
  if (order.status !== 'pending' || cardHoldExpired(order, now)) {
    throw new MockApiError(
      'Đơn này đã huỷ vì quá hạn thanh toán — các con Bakugan đã được mở bán lại.',
      409,
    );
  }
}

/** Một đơn của chính khách đang đăng nhập (trang kết quả thanh toán). */
export async function fetchMyOrder(orderId: string): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Order>>(`/orders/me/${orderId}`);
    return data.data;
  }
  sweepExpiredCardHolds();
  return mockDelay(hydrateOrder(findOwnOrder(orderId)), 120);
}

/**
 * Mở phiên thanh toán thẻ. `redirectUrl` là trang của cổng thanh toán (bản mock là
 * đường dẫn nội bộ tới cổng giả lập).
 */
export async function startCardPayment(orderId: string): Promise<{ redirectUrl: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ redirectUrl: string }>>(
      '/payments/card/sessions',
      { orderId, returnUrl: `${window.location.origin}${ROUTES.checkoutResult(orderId)}` },
    );
    return data.data;
  }
  sweepExpiredCardHolds();
  assertPayable(findOwnOrder(orderId));
  return mockDelay({ redirectUrl: ROUTES.cardGateway(orderId) }, 150);
}

/** Đơn trong nước trả thẻ không được thì đổi sang COD / chuyển khoản / MoMo, giữ nguyên đơn. */
export async function switchPaymentMethod(
  orderId: string,
  method: Exclude<PaymentMethod, 'card'>,
): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<Order>>(
      `/orders/me/${orderId}/payment-method`,
      { method },
    );
    return data.data;
  }
  sweepExpiredCardHolds();
  const current = findOwnOrder(orderId);
  assertPayable(current);
  if (current.shippingRegion === 'international') {
    throw new MockApiError('Đơn gửi ra nước ngoài chỉ thanh toán bằng thẻ.', 409);
  }
  const updated = updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId)!;
    const at = new Date().toISOString();
    order.paymentMethod = method;
    delete order.cardPayment;
    recordStatus(
      order,
      order.status,
      'Khách hàng',
      at,
      `Khách đổi từ thẻ sang ${PAYMENT_METHOD_LABELS[method].toLowerCase()}.`,
    );
    return order;
  });
  return mockDelay(hydrateOrder(updated), 250);
}

/** Khách tự huỷ đơn chưa thanh toán (VD đổi ý khi đang trả thẻ) — hàng được mở bán lại ngay. */
export async function cancelMyUnpaidOrder(orderId: string): Promise<Order> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Order>>(`/orders/me/${orderId}/cancel`);
    return data.data;
  }
  sweepExpiredCardHolds();
  const current = findOwnOrder(orderId);
  if (current.status !== 'pending' || current.paymentStatus !== 'unpaid') {
    throw new MockApiError('Đơn này không tự huỷ được nữa — nhắn shop để được hỗ trợ nhé.', 409);
  }
  const updated = updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId)!;
    const at = new Date().toISOString();
    releaseCancelledOrder(db, order, 'customer-request', 'Khách huỷ khi chưa thanh toán.', at);
    recordStatus(order, 'cancelled', 'Khách hàng', at, 'Khách huỷ khi chưa thanh toán.');
    return order;
  });
  return mockDelay(hydrateOrder(updated), 250);
}

/* ---------------- Cổng thanh toán giả lập (chỉ chế độ mock) ---------------- */

export type MockCardOutcome = 'success' | 'otp' | 'declined' | 'insufficient';

/** Thẻ thử — số khác đều bị từ chối, để không ai lỡ nhập thẻ thật vào cổng giả lập. */
export const MOCK_TEST_CARDS: ReadonlyArray<{
  number: string;
  brand: CardBrand;
  outcome: MockCardOutcome;
  note: string;
}> = [
  { number: '4242 4242 4242 4242', brand: 'visa', outcome: 'success', note: 'Thành công' },
  {
    number: '4000 0000 0000 3220',
    brand: 'visa',
    outcome: 'otp',
    note: 'Cần xác thực 3-D Secure (OTP 123456)',
  },
  { number: '5555 5555 5555 4444', brand: 'mastercard', outcome: 'success', note: 'Thành công' },
  { number: '3530 1113 3330 0000', brand: 'jcb', outcome: 'success', note: 'Thành công' },
  { number: '4000 0000 0000 0002', brand: 'visa', outcome: 'declined', note: 'Bị từ chối' },
  { number: '4000 0000 0000 9995', brand: 'visa', outcome: 'insufficient', note: 'Không đủ số dư' },
];

export const MOCK_OTP = '123456';

export interface MockCardInput {
  number: string;
  /** MM/YY */
  expiry: string;
  cvc: string;
  holder: string;
}

export type MockGatewayResult =
  | { status: 'succeeded' }
  | { status: 'requires_otp'; brand: CardBrand; last4: string }
  | { status: 'failed'; message: string };

export interface MockGatewaySession {
  orderId: string;
  orderCode: string;
  amount: number;
  expiresAt: string;
  /** Tỉ giá tham khảo để hiện ≈ USD */
  usdRate: number;
  /** Đơn đã trả / đã huỷ thì cổng đưa khách về trang kết quả luôn */
  closed: boolean;
}

/** Thẻ đang chờ nhập OTP — chỉ giữ trong bộ nhớ (hãng + 4 số cuối), không lưu số thẻ. */
const pendingOtp = new Map<string, { brand: CardBrand; last4: string }>();

function requireMock(): void {
  if (!USE_MOCK) throw new MockApiError('Cổng giả lập chỉ có ở bản chạy thử.', 404);
}

function gatewayOrder(orderId: string): StoredOrder {
  const order = readDb().orders.find((item) => item.id === orderId);
  if (!order) throw new MockApiError('Phiên thanh toán không tồn tại.', 404);
  return order;
}

function markPaid(orderId: string, brand: CardBrand, last4: string): void {
  updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId)!;
    const at = new Date().toISOString();
    const transactionId =
      `GD${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    order.paymentStatus = 'paid';
    order.cardPayment = {
      ...order.cardPayment!,
      attempts: order.cardPayment!.attempts + 1,
      brand,
      last4,
      transactionId,
      paidAt: at,
      lastError: undefined,
    };
    // Vẫn "Chờ xác nhận": shop kiểm hàng, gọi khách rồi mới đóng gói.
    recordStatus(
      order,
      order.status,
      'Cổng thanh toán',
      at,
      `Đã thanh toán ${formatCurrency(order.total)} bằng ${describeCard(order.cardPayment)} — mã giao dịch ${transactionId}.`,
    );
  });
}

function recordFailure(orderId: string, message: string, countAttempt = true): void {
  updateDb((db) => {
    const order = db.orders.find((item) => item.id === orderId)!;
    order.cardPayment = {
      ...order.cardPayment!,
      attempts: order.cardPayment!.attempts + (countAttempt ? 1 : 0),
      lastError: message,
    };
    order.updatedAt = new Date().toISOString();
  });
}

export async function mockGatewaySession(orderId: string): Promise<MockGatewaySession> {
  requireMock();
  sweepExpiredCardHolds();
  const order = gatewayOrder(orderId);
  let closed = false;
  try {
    assertPayable(order);
  } catch {
    closed = true;
  }
  return mockDelay(
    {
      orderId,
      orderCode: order.code,
      amount: order.total,
      expiresAt: order.cardPayment?.expiresAt ?? order.createdAt,
      usdRate: readDb().shopSettings.international.usdRate,
      closed,
    },
    120,
  );
}

const FAILURE_MESSAGES: Record<Exclude<MockCardOutcome, 'success' | 'otp'>, string> = {
  declined: 'Ngân hàng phát hành thẻ đã từ chối giao dịch. Thử thẻ khác hoặc liên hệ ngân hàng.',
  insufficient: 'Thẻ không đủ số dư / hạn mức cho giao dịch này.',
};

/** Khách bấm "Thanh toán" trên cổng giả lập. Chỉ nhận thẻ thử. */
export async function mockGatewayPay(
  orderId: string,
  card: MockCardInput,
): Promise<MockGatewayResult> {
  requireMock();
  sweepExpiredCardHolds();
  assertPayable(gatewayOrder(orderId));
  if (card.holder.trim().length < 2) throw new MockApiError('Nhập tên in trên thẻ.', 422);
  if (!luhnValid(card.number)) throw new MockApiError('Số thẻ không hợp lệ.', 422);
  if (!expiryValid(card.expiry))
    throw new MockApiError('Thẻ đã hết hạn hoặc sai hạn (MM/YY).', 422);
  if (!/^\d{3,4}$/.test(card.cvc.trim())) throw new MockApiError('Mã CVC/CVV gồm 3–4 số.', 422);

  const digits = cardDigits(card.number);
  const test = MOCK_TEST_CARDS.find((item) => cardDigits(item.number) === digits);
  if (!test) {
    throw new MockApiError(
      'Đây là cổng thanh toán giả lập — chỉ nhận các thẻ thử bên dưới. Đừng nhập thẻ thật.',
      422,
    );
  }
  const last4 = digits.slice(-4);
  if (test.outcome === 'success') {
    markPaid(orderId, test.brand, last4);
    return mockDelay({ status: 'succeeded' }, 900);
  }
  if (test.outcome === 'otp') {
    pendingOtp.set(orderId, { brand: test.brand, last4 });
    return mockDelay({ status: 'requires_otp', brand: test.brand, last4 }, 700);
  }
  const message = FAILURE_MESSAGES[test.outcome];
  recordFailure(orderId, message);
  return mockDelay({ status: 'failed', message }, 900);
}

/** Bước xác thực 3-D Secure: nhập OTP ngân hàng gửi (thẻ thử dùng 123456). */
export async function mockGatewayConfirmOtp(
  orderId: string,
  otp: string,
): Promise<MockGatewayResult> {
  requireMock();
  const pending = pendingOtp.get(orderId);
  if (!pending) {
    throw new MockApiError('Phiên xác thực đã hết — bạn nhập lại thẻ nhé.', 409);
  }
  pendingOtp.delete(orderId);
  sweepExpiredCardHolds();
  assertPayable(gatewayOrder(orderId));
  if (otp.trim() !== MOCK_OTP) {
    const message = 'Xác thực 3-D Secure không thành công (sai mã OTP).';
    recordFailure(orderId, message);
    return mockDelay({ status: 'failed', message }, 700);
  }
  markPaid(orderId, pending.brand, pending.last4);
  return mockDelay({ status: 'succeeded' }, 800);
}

/** Khách bấm "Huỷ, quay lại cửa hàng" trên cổng. */
export async function mockGatewayAbort(orderId: string): Promise<void> {
  requireMock();
  pendingOtp.delete(orderId);
  const order = gatewayOrder(orderId);
  if (order.paymentMethod === 'card' && order.paymentStatus === 'unpaid' && order.cardPayment) {
    recordFailure(orderId, 'Bạn đã dừng ở trang thanh toán thẻ.', false);
  }
  await mockDelay(null, 100);
}

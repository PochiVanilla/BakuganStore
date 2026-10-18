import { eq } from 'drizzle-orm';
import express, { Router } from 'express';
import { z } from 'zod';
import { cardPayments, orders, paymentAttempts } from '../../db/schema';
import { withTransaction } from '../../db/tx';
import { conflict, notFound, parseInput, unprocessable } from '../../lib/errors';
import { currentUser, requireCustomer } from '../../middleware/auth';
import {
  cardDigits,
  expiryValid,
  luhnValid,
  MOCK_FAILURE_MESSAGES,
  MOCK_OTP,
  MOCK_OTP_FAILED,
  MOCK_TEST_CARDS,
} from '../../shared/orders';
import type { CardBrand } from '../../shared/types';
import { readShopSettings } from '../settings/shop';
import { MockCardGateway, mockTransactionId } from './gateway';
import {
  gatewayResponse,
  handleGatewayCallback,
  openCardSession,
  type PaymentDeps,
} from './service';

const sessionSchema = z.object({
  orderId: z.string().max(36),
  returnUrl: z.string().max(500),
});

const cardSchema = z.object({
  number: z.string().max(40),
  expiry: z.string().max(10),
  cvc: z.string().max(10),
  holder: z.string().max(100),
});

const otpSchema = z.object({ otp: z.string().max(10) });

/** /api/payments — mở phiên trả thẻ, nhận kết quả cổng báo về, và cổng giả lập (khi dùng `mock`). */
export function paymentsRouter(deps: PaymentDeps): Router {
  const router = Router();

  router.post('/card/sessions', requireCustomer, async (req, res) => {
    const { orderId, returnUrl } = parseInput(sessionSchema, req.body);
    res.json({ data: await openCardSession(deps, currentUser(req).id, orderId, returnUrl) });
  });

  /*
   * IPN: cổng gọi thẳng vào server (không qua trình duyệt) để báo kết quả. Không cần đăng nhập;
   * tin hay không là nhờ chữ ký. Trả lời theo đúng định dạng cổng yêu cầu.
   */
  router.post(
    '/card/ipn/:gateway',
    express.urlencoded({ extended: false, limit: '20kb' }),
    async (req, res) => {
      if (!deps.gateway || req.params.gateway !== deps.gateway.name) {
        throw notFound('Không tìm thấy đường dẫn này.');
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const params = Object.fromEntries(
        Object.entries(body).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
      res.json(gatewayResponse(await handleGatewayCallback(deps, params)));
    },
  );

  if (deps.gateway instanceof MockCardGateway) {
    router.use('/mock-gateway', mockGatewayRouter(deps, deps.gateway));
  }
  return router;
}

/* ---------------- Cổng giả lập chạy trên server ---------------- */

type MockResult =
  | { status: 'succeeded' }
  | { status: 'requires_otp'; brand: CardBrand; last4: string }
  | { status: 'failed'; message: string };

/** Thẻ đang chờ nhập OTP — chỉ giữ trong bộ nhớ (hãng + 4 số cuối), không bao giờ có số thẻ. */
const OTP_TTL_MS = 10 * 60_000;

/**
 * Trang "cổng thanh toán" giả lập của web (/thanh-toan/cong-the/…) gọi các đường này.
 * Như cổng thật, cổng không biết khách là ai: mọi thứ gắn với mã lượt thanh toán.
 * Kết quả được báo về bằng tham số có chữ ký, đi đúng luồng IPN của cổng thật.
 */
function mockGatewayRouter(deps: PaymentDeps, gateway: MockCardGateway): Router {
  const router = Router();
  const pendingOtp = new Map<string, { brand: CardBrand; last4: string; until: number }>();

  async function openAttempt(attemptId: string) {
    const [row] = await deps.db
      .select({ attempt: paymentAttempts, order: orders })
      .from(paymentAttempts)
      .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
      .where(eq(paymentAttempts.id, attemptId))
      .limit(1);
    if (!row) throw notFound('Phiên thanh toán không tồn tại.');
    return row;
  }

  function payable(row: Awaited<ReturnType<typeof openAttempt>>): boolean {
    return (
      row.attempt.status === 'open' &&
      row.order.paymentMethod === 'card' &&
      row.order.paymentStatus === 'unpaid' &&
      row.order.status === 'pending'
    );
  }

  async function report(
    attemptId: string,
    amount: number,
    outcome:
      | { success: true; brand: CardBrand; last4: string }
      | { success: false; code: string; message: string },
  ): Promise<MockResult> {
    const params = gateway.buildCallback(
      outcome.success
        ? {
            attemptId,
            amount,
            success: true,
            gatewayTxnId: mockTransactionId(),
            brand: outcome.brand,
            last4: outcome.last4,
            code: '00',
            message: 'Giao dịch thành công',
          }
        : { attemptId, amount, success: false, code: outcome.code, message: outcome.message },
    );
    await handleGatewayCallback(deps, params);
    return outcome.success
      ? { status: 'succeeded' }
      : { status: 'failed', message: outcome.message };
  }

  router.get('/:attemptId', async (req, res) => {
    const row = await openAttempt(req.params.attemptId);
    const [card] = await deps.db
      .select({ expiresAt: cardPayments.expiresAt })
      .from(cardPayments)
      .where(eq(cardPayments.orderId, row.order.id));
    const shop = await readShopSettings(deps.db);
    res.json({
      data: {
        orderId: row.order.id,
        orderCode: row.order.code,
        amount: row.attempt.amount,
        expiresAt: (card?.expiresAt ?? row.order.createdAt).toISOString(),
        usdRate: shop.international.usdRate,
        closed: !payable(row),
      },
    });
  });

  router.post('/:attemptId/pay', async (req, res) => {
    const card = parseInput(cardSchema, req.body);
    const row = await openAttempt(req.params.attemptId);
    if (!payable(row))
      throw conflict('Phiên thanh toán này đã đóng — quay lại trang đơn hàng nhé.');
    if (card.holder.trim().length < 2) throw unprocessable('Nhập tên in trên thẻ.');
    if (!luhnValid(card.number)) throw unprocessable('Số thẻ không hợp lệ.');
    if (!expiryValid(card.expiry)) throw unprocessable('Thẻ đã hết hạn hoặc sai hạn (MM/YY).');
    if (!/^\d{3,4}$/.test(card.cvc.trim())) throw unprocessable('Mã CVC/CVV gồm 3–4 số.');
    const digits = cardDigits(card.number);
    const test = MOCK_TEST_CARDS.find((entry) => cardDigits(entry.number) === digits);
    if (!test) {
      throw unprocessable(
        'Đây là cổng thanh toán giả lập — chỉ nhận các thẻ thử bên dưới. Đừng nhập thẻ thật.',
      );
    }
    const last4 = digits.slice(-4);
    let result: MockResult;
    if (test.outcome === 'success') {
      result = await report(row.attempt.id, row.attempt.amount, {
        success: true,
        brand: test.brand,
        last4,
      });
    } else if (test.outcome === 'otp') {
      pendingOtp.set(row.attempt.id, { brand: test.brand, last4, until: Date.now() + OTP_TTL_MS });
      result = { status: 'requires_otp', brand: test.brand, last4 };
    } else {
      result = await report(row.attempt.id, row.attempt.amount, {
        success: false,
        code: test.outcome === 'declined' ? '05' : '51',
        message: MOCK_FAILURE_MESSAGES[test.outcome],
      });
    }
    res.json({ data: result });
  });

  // Bước xác thực 3-D Secure: nhập OTP ngân hàng gửi (thẻ thử dùng 123456).
  router.post('/:attemptId/otp', async (req, res) => {
    const { otp } = parseInput(otpSchema, req.body);
    const pending = pendingOtp.get(req.params.attemptId);
    pendingOtp.delete(req.params.attemptId);
    if (!pending || pending.until < Date.now()) {
      throw conflict('Phiên xác thực đã hết — bạn nhập lại thẻ nhé.');
    }
    const row = await openAttempt(req.params.attemptId);
    if (!payable(row))
      throw conflict('Phiên thanh toán này đã đóng — quay lại trang đơn hàng nhé.');
    const result =
      otp.trim() === MOCK_OTP
        ? await report(row.attempt.id, row.attempt.amount, {
            success: true,
            brand: pending.brand,
            last4: pending.last4,
          })
        : await report(row.attempt.id, row.attempt.amount, {
            success: false,
            code: '99',
            message: MOCK_OTP_FAILED,
          });
    res.json({ data: result });
  });

  // Khách bấm "Huỷ, quay lại cửa hàng" trên cổng: đóng lượt này, ghi lý do để trang đơn hiện lại.
  router.post('/:attemptId/abort', async (req, res) => {
    pendingOtp.delete(req.params.attemptId);
    await withTransaction(deps.db, async (tx) => {
      const [attempt] = await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.id, req.params.attemptId))
        .for('update');
      if (!attempt || attempt.status !== 'open') return;
      await tx
        .update(paymentAttempts)
        .set({ status: 'closed', message: 'Khách dừng ở trang cổng.', finishedAt: new Date() })
        .where(eq(paymentAttempts.id, attempt.id));
      await tx
        .update(cardPayments)
        .set({ lastError: 'Bạn đã dừng ở trang thanh toán thẻ.' })
        .where(eq(cardPayments.orderId, attempt.orderId));
    });
    res.json({ data: { ok: true } });
  });

  return router;
}

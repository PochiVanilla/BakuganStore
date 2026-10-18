import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { cardPayments, orders } from '../../db/schema';
import { withTransaction } from '../../db/tx';
import { conflict, notFound, parseInput, unprocessable } from '../../lib/errors';
import { currentUser, requireCustomer } from '../../middleware/auth';
import { PAYMENT_METHOD_LABELS } from '../../shared/orders';
import { MANUAL_PAYMENT_METHODS } from '../../shared/types';
import { checkoutConfigOf, readShopSettings, shopBankOf } from '../settings/shop';
import { checkCoupon, listActiveCoupons, toCoupon } from './coupons';
import {
  addEvent,
  assertCardPayable,
  cancelOrder,
  closeOpenAttempts,
  customerActor,
  expireCardHolds,
  MY_ORDER_NOT_FOUND,
} from './mutations';
import { checkoutSchema, placeOrder, type PlaceOrderDeps } from './placeOrder';
import { loadOrder, loadOrders, lockCardPayment, lockOrder } from './store';

const applyCouponSchema = z.object({
  code: z.string().max(60),
  subtotal: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

const switchMethodSchema = z.object({ method: z.enum(MANUAL_PAYMENT_METHODS) });

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

/** /api/checkout/config, /api/shop/bank, /api/coupons… — ai cũng xem được. */
export function checkoutRouter(deps: Pick<PlaceOrderDeps, 'db' | 'cardGatewayReady'>): Router {
  const router = Router();

  router.get('/checkout/config', async (_req, res) => {
    const shop = await readShopSettings(deps.db);
    res.json({ data: checkoutConfigOf(shop, deps.cardGatewayReady) });
  });

  router.get('/shop/bank', async (_req, res) => {
    res.json({ data: shopBankOf(await readShopSettings(deps.db)) });
  });

  router.get('/coupons', async (_req, res) => {
    res.json({ data: await listActiveCoupons(deps.db) });
  });

  // Chỉ để xem trước số tiền giảm; lúc đặt đơn server kiểm tra lại từ đầu.
  router.post('/coupons/apply', async (req, res) => {
    const { code, subtotal } = parseInput(applyCouponSchema, req.body);
    const user = req.auth?.user;
    const row = await checkCoupon(deps.db, code, subtotal, {
      userId: user?.role === 'customer' ? user.id : undefined,
    });
    res.json({ data: toCoupon(row) });
  });

  return router;
}

/** /api/orders — khách đặt đơn và xem / huỷ đơn của chính mình. */
export function ordersRouter(deps: PlaceOrderDeps): Router {
  const router = Router();
  router.use(requireCustomer);

  router.post('/', async (req, res) => {
    const user = currentUser(req);
    const input = parseInput(checkoutSchema, req.body);
    const header = req.get('Idempotency-Key');
    if (header !== undefined && !IDEMPOTENCY_KEY.test(header)) {
      throw unprocessable('Mã chống gửi trùng (Idempotency-Key) không hợp lệ.');
    }
    const { orderId } = await placeOrder(deps, user, input, header);
    res.status(201).json({ data: await loadOrder(deps.db, orderId, 'customer', user.id) });
  });

  router.get('/me', async (req, res) => {
    await expireCardHolds(deps);
    const userId = currentUser(req).id;
    res.json({ data: await loadOrders(deps.db, 'customer', { where: eq(orders.userId, userId) }) });
  });

  router.get('/me/:id', async (req, res) => {
    await expireCardHolds(deps);
    const order = await loadOrder(deps.db, req.params.id, 'customer', currentUser(req).id);
    if (!order) throw notFound(MY_ORDER_NOT_FOUND);
    res.json({ data: order });
  });

  // Khách tự huỷ đơn chưa thanh toán (VD đổi ý khi đang trả thẻ) — hàng được mở bán lại ngay.
  router.post('/me/:id/cancel', async (req, res) => {
    const userId = currentUser(req).id;
    await expireCardHolds(deps);
    const released = await withTransaction(deps.db, async (tx) => {
      const order = await lockOrder(tx, req.params.id, userId);
      if (!order) throw notFound(MY_ORDER_NOT_FOUND);
      if (order.status !== 'pending' || order.paymentStatus !== 'unpaid') {
        throw conflict('Đơn này không tự huỷ được nữa — nhắn shop để được hỗ trợ nhé.');
      }
      return cancelOrder(tx, order, {
        reason: 'customer-request',
        note: 'Khách huỷ khi chưa thanh toán.',
        actor: customerActor(userId),
      });
    });
    if (released > 0) deps.catalog.invalidate();
    res.json({ data: await loadOrder(deps.db, req.params.id, 'customer', userId) });
  });

  // Đơn trong nước trả thẻ không được thì đổi sang COD / chuyển khoản / MoMo, giữ nguyên đơn.
  router.patch('/me/:id/payment-method', async (req, res) => {
    const userId = currentUser(req).id;
    const { method } = parseInput(switchMethodSchema, req.body);
    await expireCardHolds(deps);
    await withTransaction(deps.db, async (tx) => {
      const order = await lockOrder(tx, req.params.id, userId);
      if (!order) throw notFound(MY_ORDER_NOT_FOUND);
      const card = await lockCardPayment(tx, order.id);
      assertCardPayable(order, card?.expiresAt);
      if (order.shippingRegion === 'international') {
        throw conflict('Đơn gửi ra nước ngoài chỉ thanh toán bằng thẻ.');
      }
      const at = new Date();
      // Lượt trả thẻ đang mở bị đóng: nếu cổng vẫn báo trừ tiền sau đó thì mở sự cố tiền, không tự hoàn.
      await closeOpenAttempts(tx, order.id, at);
      await tx.delete(cardPayments).where(eq(cardPayments.orderId, order.id));
      await tx.update(orders).set({ paymentMethod: method }).where(eq(orders.id, order.id));
      await addEvent(
        tx,
        order.id,
        order.status,
        customerActor(userId),
        `Khách đổi từ thẻ sang ${PAYMENT_METHOD_LABELS[method].toLowerCase()}.`,
        at,
      );
    });
    res.json({ data: await loadOrder(deps.db, req.params.id, 'customer', userId) });
  });

  return router;
}

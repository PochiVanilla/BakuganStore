import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import {
  cardPayments,
  idempotencyKeys,
  items,
  media,
  orderIssues,
  paymentAttempts,
  paymentEvents,
  refunds,
} from '../../src/db/schema';
import { cleanupIdempotencyKeys, cleanupUnusedMedia } from '../../src/jobs';
import { newId } from '../../src/lib/ids';
import { FeedCatalog } from '../../src/modules/catalog/store';
import { expireCardHolds } from '../../src/modules/orders/mutations';
import { createCardGateway, MockCardGateway } from '../../src/modules/payments/gateway';
import {
  openTestDatabase,
  postTestFeed,
  setShopSettings,
  signInAs,
  silentLogger,
  testApp,
  testEnv,
  TEST_ORIGIN,
} from '../helpers';

let database: Database;
let app: ReturnType<typeof testApp>;
let catalog: FeedCatalog;
let admin: { Authorization: string };
let customer: { id: string; auth: { Authorization: string } };
let uploadDir: string;
const env = () => testEnv({ CARD_GATEWAY: 'mock', UPLOAD_DIR: uploadDir });
let gateway: MockCardGateway;

beforeAll(async () => {
  uploadDir = mkdtempSync(path.join(tmpdir(), 'tdb-pay-'));
  database = await openTestDatabase();
  catalog = new FeedCatalog(database.db);
  app = testApp(database, { env: env(), catalog });
  gateway = createCardGateway(env()) as MockCardGateway;
  admin = (await signInAs(app, database, 'admin')).auth;
  customer = await signInAs(app, database, 'customer', 'Lê Thẻ Khách');
  await setShopSettings(database, {
    cardPayments: true,
    international: { enabled: true, feeAsia: 350_000, feeWorld: 650_000, usdRate: 26_000 },
  });
});

afterAll(async () => {
  await database.close();
  rmSync(uploadDir, { recursive: true, force: true });
});

const RETURN_URL = `${TEST_ORIGIN}/thanh-toan/ket-qua/x`;

async function cardOrder(auth = customer.auth, count = 1) {
  const feed = await postTestFeed(app, admin, count);
  const res = await request(app)
    .post('/api/orders')
    .set(auth)
    .send({
      itemIds: feed.items.map((item) => item.id),
      receiverName: 'Lê Thẻ Khách',
      phone: '0912345678',
      addressLine: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM',
      paymentMethod: 'card',
    })
    .expect(201);
  return { order: res.body.data, feed };
}

async function openSession(orderId: string, auth = customer.auth) {
  const res = await request(app)
    .post('/api/payments/card/sessions')
    .set(auth)
    .send({ orderId, returnUrl: RETURN_URL })
    .expect(200);
  const url = res.body.data.redirectUrl as string;
  return new URL(url, TEST_ORIGIN).searchParams.get('phien')!;
}

const gatewayApi = (attempt: string, action = '') =>
  `/api/payments/mock-gateway/${attempt}${action}`;

const CARD = { number: '4242 4242 4242 4242', expiry: '12/40', cvc: '123', holder: 'LE THE KHACH' };

async function myOrder(orderId: string, auth = customer.auth) {
  return (await request(app).get(`/api/orders/me/${orderId}`).set(auth).expect(200)).body.data;
}

describe('trả thẻ qua cổng giả lập trên server', () => {
  it('đơn thẻ giữ hàng 15 phút; mở phiên → trang cổng → trả thành công', async () => {
    const { order } = await cardOrder();
    const hold =
      new Date(order.cardPayment.expiresAt).getTime() - new Date(order.createdAt).getTime();
    expect(Math.round(hold / 60_000)).toBe(15);
    expect(order.timeline[0].note).toContain('giữ hàng 15 phút');

    await request(app)
      .post('/api/payments/card/sessions')
      .set(customer.auth)
      .send({ orderId: order.id, returnUrl: 'https://trang-la.example/x' })
      .expect(422);
    const attempt = await openSession(order.id);
    const session = (await request(app).get(gatewayApi(attempt)).expect(200)).body.data;
    expect(session).toMatchObject({
      orderId: order.id,
      orderCode: order.code,
      amount: order.total,
      closed: false,
    });

    // Thẻ thật (không phải thẻ thử) bị từ chối ngay, không xử lý gì.
    const real = await request(app)
      .post(gatewayApi(attempt, '/pay'))
      .send({ ...CARD, number: '4111 1111 1111 1111' })
      .expect(422);
    expect(real.body.message).toContain('chỉ nhận các thẻ thử');

    const paid = await request(app).post(gatewayApi(attempt, '/pay')).send(CARD).expect(200);
    expect(paid.body.data).toEqual({ status: 'succeeded' });
    const after = await myOrder(order.id);
    expect(after).toMatchObject({ status: 'pending', paymentStatus: 'paid' });
    expect(after.cardPayment).toMatchObject({ brand: 'visa', last4: '4242', attempts: 1 });
    expect(after.cardPayment.transactionId).toMatch(/^GD[0-9A-F]{12}$/);
    expect(after.timeline.at(-1)).toMatchObject({ actor: 'Cổng thanh toán' });
    expect(after.timeline.at(-1).note).toContain('Visa •••• 4242');

    // Không lưu số thẻ ở đâu: dữ liệu cổng gửi về chỉ có 4 số cuối.
    const events = await database.db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.attemptId, attempt));
    expect(JSON.stringify(events)).not.toContain('4242424242424242');
    expect(JSON.stringify(events)).not.toContain('4242 4242 4242 4242');

    const closed = (await request(app).get(gatewayApi(attempt))).body.data;
    expect(closed.closed).toBe(true);
    const again = await request(app)
      .post('/api/payments/card/sessions')
      .set(customer.auth)
      .send({ orderId: order.id, returnUrl: RETURN_URL })
      .expect(409);
    expect(again.body.message).toBe('Đơn này đã được thanh toán rồi.');
  });

  it('thẻ bị từ chối ghi lý do; thẻ cần OTP: sai OTP thất bại, đúng OTP thì trả xong', async () => {
    const { order } = await cardOrder();
    const first = await openSession(order.id);
    const declined = await request(app)
      .post(gatewayApi(first, '/pay'))
      .send({ ...CARD, number: '4000 0000 0000 0002' })
      .expect(200);
    expect(declined.body.data.status).toBe('failed');
    expect((await myOrder(order.id)).cardPayment).toMatchObject({
      attempts: 1,
      lastError:
        'Ngân hàng phát hành thẻ đã từ chối giao dịch. Thử thẻ khác hoặc liên hệ ngân hàng.',
    });

    const second = await openSession(order.id);
    const otpCard = { ...CARD, number: '4000 0000 0000 3220' };
    const needOtp = await request(app).post(gatewayApi(second, '/pay')).send(otpCard).expect(200);
    expect(needOtp.body.data).toEqual({ status: 'requires_otp', brand: 'visa', last4: '3220' });
    const wrong = await request(app)
      .post(gatewayApi(second, '/otp'))
      .send({ otp: '000000' })
      .expect(200);
    expect(wrong.body.data).toEqual({
      status: 'failed',
      message: 'Xác thực 3-D Secure không thành công (sai mã OTP).',
    });

    const third = await openSession(order.id);
    await request(app).post(gatewayApi(third, '/pay')).send(otpCard).expect(200);
    const ok = await request(app)
      .post(gatewayApi(third, '/otp'))
      .send({ otp: '123456' })
      .expect(200);
    expect(ok.body.data.status).toBe('succeeded');
    expect((await myOrder(order.id)).paymentStatus).toBe('paid');
  });

  it('khách bấm "Huỷ, quay lại cửa hàng": đóng lượt, ghi lý do, mở lượt mới được', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    await request(app).post(gatewayApi(attempt, '/abort')).expect(200);
    expect((await myOrder(order.id)).cardPayment.lastError).toBe(
      'Bạn đã dừng ở trang thanh toán thẻ.',
    );
    await request(app).post(gatewayApi(attempt, '/pay')).send(CARD).expect(409);
    const next = await openSession(order.id);
    expect(next).not.toBe(attempt);
  });

  it('IPN: chữ ký sai bị từ chối và ghi lại; cổng gửi lặp chỉ xử lý một lần', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    const params = gateway.buildCallback({
      attemptId: attempt,
      amount: order.total,
      success: true,
      gatewayTxnId: 'GDIPN0001',
      brand: 'mastercard',
      last4: '4444',
      code: '00',
      message: 'OK',
    });
    const forged = await request(app)
      .post('/api/payments/card/ipn/mock')
      .send({ ...params, amount: '1' })
      .expect(200);
    expect(forged.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
    expect((await myOrder(order.id)).paymentStatus).toBe('unpaid');

    const first = await request(app)
      .post('/api/payments/card/ipn/mock')
      .type('form')
      .send(params)
      .expect(200);
    expect(first.body.RspCode).toBe('00');
    const repeat = await request(app).post('/api/payments/card/ipn/mock').send(params).expect(200);
    expect(repeat.body).toEqual({ RspCode: '02', Message: 'Order already confirmed' });
    const paid = await myOrder(order.id);
    expect(paid.cardPayment).toMatchObject({
      brand: 'mastercard',
      last4: '4444',
      transactionId: 'GDIPN0001',
    });
    expect(
      paid.timeline.filter((event: { actor: string }) => event.actor === 'Cổng thanh toán'),
    ).toHaveLength(1);
    await request(app).post('/api/payments/card/ipn/vnpay').send(params).expect(404);
  });

  it('cổng báo sai số tiền: không ghi đã trả, mở sự cố tiền', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    const params = gateway.buildCallback({
      attemptId: attempt,
      amount: order.total - 1_000,
      success: true,
      gatewayTxnId: 'GDSAITIEN',
      code: '00',
      message: 'OK',
    });
    const res = await request(app).post('/api/payments/card/ipn/mock').send(params).expect(200);
    expect(res.body.RspCode).toBe('04');
    const after = await myOrder(order.id);
    expect(after.paymentStatus).toBe('unpaid');
    expect(after.needsShopContact).toBe(true);
  });
});

describe('giữ hàng 15 phút, trả trễ, trả trùng — không bao giờ tự hoàn tiền', () => {
  async function expire(orderId: string) {
    await database.db
      .update(cardPayments)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(cardPayments.orderId, orderId));
    // Lượt mở quá 20 phút thì không còn được chờ thêm.
    await database.db
      .update(paymentAttempts)
      .set({ createdAt: new Date(Date.now() - 30 * 60_000) })
      .where(eq(paymentAttempts.orderId, orderId));
    return expireCardHolds({ db: database.db, catalog, logger: silentLogger });
  }

  it('quá hạn thì tự huỷ, mở bán lại; khách đang ở trang cổng (lượt mở < 20 phút) thì chờ thêm', async () => {
    const { order, feed } = await cardOrder();
    await openSession(order.id);
    await database.db
      .update(cardPayments)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(cardPayments.orderId, order.id));
    expect(await expireCardHolds({ db: database.db, catalog, logger: silentLogger })).toBe(0);
    expect(await expire(order.id)).toBeGreaterThanOrEqual(1);
    const after = await myOrder(order.id);
    expect(after).toMatchObject({ status: 'cancelled', cancelReason: 'payment-timeout' });
    expect(after.timeline.at(-1)).toMatchObject({ actor: 'Hệ thống' });
    const [item] = await database.db.select().from(items).where(eq(items.id, feed.items[0]!.id));
    expect(item!.status).toBe('available');
    const publicFeed = (await request(app).get(`/api/feeds/${feed.number}`)).body.data;
    expect(publicFeed.items[0].status).toBe('available');
  });

  it('trả trễ khi hàng vẫn còn: giữ lại đơn cho khách', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    await expire(order.id);
    expect((await myOrder(order.id)).status).toBe('cancelled');
    const outcome = await request(app)
      .post('/api/payments/card/ipn/mock')
      .send(
        gateway.buildCallback({
          attemptId: attempt,
          amount: order.total,
          success: true,
          gatewayTxnId: 'GDTRE01',
          brand: 'visa',
          last4: '4242',
          code: '00',
          message: 'OK',
        }),
      )
      .expect(200);
    expect(outcome.body.RspCode).toBe('00');
    const after = await myOrder(order.id);
    expect(after).toMatchObject({ status: 'pending', paymentStatus: 'paid' });
    expect(after.cancelReason).toBeUndefined();
    expect(after.needsShopContact).toBeUndefined();
    const [item] = await database.db
      .select()
      .from(items)
      .where(eq(items.id, order.items[0].itemId));
    expect(item).toMatchObject({ status: 'sold', orderId: order.id });
  });

  it('trả trễ khi hàng đã bán cho người khác: đơn vẫn huỷ, ghi đã trả, mở sự cố tiền, KHÔNG tự hoàn', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    await expire(order.id);
    const other = await signInAs(app, database, 'customer');
    await request(app)
      .post('/api/orders')
      .set(other.auth)
      .send({
        itemIds: [order.items[0].itemId],
        receiverName: 'Người Mua Khác',
        phone: '0987654321',
        addressLine: '99 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
        paymentMethod: 'cod',
      })
      .expect(201);
    await request(app)
      .post('/api/payments/card/ipn/mock')
      .send(
        gateway.buildCallback({
          attemptId: attempt,
          amount: order.total,
          success: true,
          gatewayTxnId: 'GDTRE02',
          brand: 'visa',
          last4: '4242',
          code: '00',
          message: 'OK',
        }),
      )
      .expect(200);
    const after = await myOrder(order.id);
    expect(after).toMatchObject({
      status: 'cancelled',
      paymentStatus: 'paid',
      needsShopContact: true,
    });
    const issues = await database.db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.orderId, order.id));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'payment',
      reportedBy: 'system',
      status: 'open',
      paymentAttemptId: attempt,
    });
    expect(issues[0]!.description).toContain('đã bán cho người khác');
    expect(
      await database.db.select().from(refunds).where(eq(refunds.orderId, order.id)),
    ).toHaveLength(0);

    // Admin thấy sự cố trong đơn; đóng sự cố (sau khi tự hoàn tiền về thẻ) thì cờ tắt.
    const list = (await request(app).get(`/api/admin/orders/${order.id}/issues`).set(admin)).body
      .data;
    expect(list[0]).toMatchObject({ reportedBy: 'system', type: 'payment' });
    const refunded = await request(app)
      .patch(`/api/admin/orders/${order.id}/payment`)
      .set(admin)
      .send({ paymentStatus: 'refunded' })
      .expect(200);
    expect(refunded.body.data.paymentStatus).toBe('refunded');
    expect(refunded.body.data.cardPayment.refundedAt).toBeDefined();
    expect(refunded.body.data.timeline.at(-1)).toMatchObject({ actor: 'Chủ shop' });
    const twice = await request(app)
      .patch(`/api/admin/orders/${order.id}/payment`)
      .set(admin)
      .send({ paymentStatus: 'refunded' })
      .expect(409);
    expect(twice.body.message).toBe('Đơn này chưa thanh toán nên không có gì để hoàn.');
    await request(app)
      .patch(`/api/admin/issues/${list[0].id}`)
      .set(admin)
      .send({ status: 'resolved', resolution: 'Đã hoàn tiền về thẻ cho khách' })
      .expect(200);
    expect((await myOrder(order.id)).needsShopContact).toBeUndefined();
    const rows = await database.db.select().from(refunds).where(eq(refunds.orderId, order.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'succeeded' });
  });

  it('khách đổi sang COD rồi cổng vẫn báo trừ tiền: ghi đã trả (shipper không thu nữa) + sự cố', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    const switched = await request(app)
      .patch(`/api/orders/me/${order.id}/payment-method`)
      .set(customer.auth)
      .send({ method: 'cod' })
      .expect(200);
    expect(switched.body.data.paymentMethod).toBe('cod');
    expect(switched.body.data.cardPayment).toBeUndefined();
    expect(switched.body.data.timeline.at(-1).note).toBe(
      'Khách đổi từ thẻ sang thanh toán khi nhận hàng.',
    );
    await request(app)
      .post('/api/payments/card/ipn/mock')
      .send(
        gateway.buildCallback({
          attemptId: attempt,
          amount: order.total,
          success: true,
          gatewayTxnId: 'GDDOI01',
          brand: 'jcb',
          last4: '0000',
          code: '00',
          message: 'OK',
        }),
      )
      .expect(200);
    const after = await myOrder(order.id);
    expect(after).toMatchObject({
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      needsShopContact: true,
    });
  });

  it('trả trùng (hai lượt cùng trừ tiền): lượt sau mở sự cố tiền, không tự hoàn', async () => {
    const { order } = await cardOrder();
    const first = await openSession(order.id);
    const second = await openSession(order.id);
    await request(app).post(gatewayApi(second, '/pay')).send(CARD).expect(200);
    await request(app)
      .post('/api/payments/card/ipn/mock')
      .send(
        gateway.buildCallback({
          attemptId: first,
          amount: order.total,
          success: true,
          gatewayTxnId: 'GDTRUNG1',
          brand: 'visa',
          last4: '1111',
          code: '00',
          message: 'OK',
        }),
      )
      .expect(200);
    const after = await myOrder(order.id);
    // Thông tin thẻ của lần trả đầu được giữ nguyên.
    expect(after).toMatchObject({ paymentStatus: 'paid', needsShopContact: true });
    expect(after.cardPayment.last4).toBe('4242');
    const [issue] = await database.db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.paymentAttemptId, first));
    expect(issue!.description).toContain('trả trùng');
    expect(
      await database.db.select().from(refunds).where(eq(refunds.orderId, order.id)),
    ).toHaveLength(0);
  });

  it('admin không đánh dấu tay đơn thẻ; hoàn tiền chỉ khi đơn đã huỷ / hoàn hàng', async () => {
    const { order } = await cardOrder();
    const attempt = await openSession(order.id);
    await request(app).post(gatewayApi(attempt, '/pay')).send(CARD).expect(200);
    const mark = await request(app)
      .patch(`/api/admin/orders/${order.id}/payment`)
      .set(admin)
      .send({ paymentStatus: 'paid' })
      .expect(409);
    expect(mark.body.message).toBe(
      'Đơn trả bằng thẻ được cổng thanh toán tự xác nhận — không đánh dấu tay được.',
    );
    const early = await request(app)
      .patch(`/api/admin/orders/${order.id}/payment`)
      .set(admin)
      .send({ paymentStatus: 'refunded' })
      .expect(409);
    expect(early.body.message).toBe('Chỉ hoàn tiền cho đơn đã huỷ hoặc đã hoàn hàng.');
  });

  it('bản thật chưa có cổng (CARD_GATEWAY=none): không đặt được đơn thẻ', async () => {
    const offline = testApp(database, { env: testEnv({ CARD_GATEWAY: 'none' }) });
    const feed = await postTestFeed(app, admin, 1);
    const res = await request(offline)
      .post('/api/orders')
      .set(customer.auth)
      .send({
        itemIds: [feed.items[0]!.id],
        receiverName: 'Lê Thẻ Khách',
        phone: '0912345678',
        addressLine: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM',
        paymentMethod: 'card',
      })
      .expect(422);
    expect(res.body.message).toBe(
      'Shop đang tạm ngưng nhận thanh toán thẻ — bạn chọn cách khác nhé.',
    );
    await request(offline).get('/api/payments/mock-gateway/abc').expect(404);
  });
});

describe('việc chạy nền', () => {
  it('dọn file tải lên không dùng sau 24 giờ; giữ file đang dùng', async () => {
    const old = new Date(Date.now() - 25 * 60 * 60_000);
    const make = async (name: string, inUse: boolean) => {
      const relative = `img/2026/01/${name}.webp`;
      mkdirSync(path.join(uploadDir, 'img/2026/01'), { recursive: true });
      writeFileSync(path.join(uploadDir, relative), 'x');
      await database.db.insert(media).values({
        id: newId(),
        path: relative,
        url: `/uploads/${relative}`,
        kind: 'image',
        mime: 'image/webp',
        bytes: 1,
        sha256: 'a'.repeat(64),
        inUse,
        createdAt: old,
      });
      return path.join(uploadDir, relative);
    };
    const orphan = await make(newId(), false);
    const kept = await make(newId(), true);
    await cleanupUnusedMedia({ database, catalog, logger: silentLogger, uploadDir });
    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(kept)).toBe(true);
  });

  it('xoá mã chống gửi trùng cũ hơn 24 giờ', async () => {
    await database.db.insert(idempotencyKeys).values({
      id: newId(),
      userId: customer.id,
      idemKey: `cu-${newId()}`,
      route: 'POST /orders',
      requestHash: 'b'.repeat(64),
      createdAt: new Date(Date.now() - 25 * 60 * 60_000),
    });
    expect(
      await cleanupIdempotencyKeys({ database, catalog, logger: silentLogger, uploadDir }),
    ).toBeGreaterThanOrEqual(1);
  });
});

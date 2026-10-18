import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import {
  auditLogs,
  couponRedemptions,
  coupons,
  idempotencyKeys,
  items,
  orders,
  users,
} from '../../src/db/schema';
import { newId } from '../../src/lib/ids';
import {
  openTestDatabase,
  postTestFeed,
  setShopSettings,
  signInAs,
  testApp,
  testEnv,
} from '../helpers';

let database: Database;
let app: ReturnType<typeof testApp>;
let admin: { Authorization: string };
let customer: { id: string; auth: { Authorization: string } };

beforeAll(async () => {
  database = await openTestDatabase();
  app = testApp(database, { env: testEnv({ CARD_GATEWAY: 'mock' }) });
  admin = (await signInAs(app, database, 'admin')).auth;
  customer = await signInAs(app, database, 'customer', 'Nguyễn Văn Khách');
});

afterAll(async () => {
  await database.close();
});

function checkout(itemIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    itemIds,
    receiverName: 'Nguyễn Văn Khách',
    phone: '0912345678',
    addressLine: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM',
    paymentMethod: 'cod',
    ...overrides,
  };
}

function order(auth: { Authorization: string }, body: Record<string, unknown>, status = 201) {
  return request(app).post('/api/orders').set(auth).send(body).expect(status);
}

describe('cấu hình thanh toán, mã giảm giá', () => {
  it('thẻ chỉ bật khi admin bật VÀ có cổng; tắt thẻ thì giao quốc tế cũng tắt', async () => {
    await setShopSettings(database, { cardPayments: false });
    let config = (await request(app).get('/api/checkout/config').expect(200)).body.data;
    expect(config).toMatchObject({ cardPayments: false, cardHoldMinutes: 15 });
    expect(config.international.enabled).toBe(false);

    await setShopSettings(database, {
      cardPayments: true,
      international: { enabled: true, feeAsia: 350_000, feeWorld: 650_000, usdRate: 26_000 },
    });
    config = (await request(app).get('/api/checkout/config')).body.data;
    expect(config).toMatchObject({ cardPayments: true, international: { enabled: true } });

    // Chưa có cổng thanh toán (bản thật mặc định): không bao giờ nhận thẻ.
    const noGateway = testApp(database, { env: testEnv({ CARD_GATEWAY: 'none' }) });
    config = (await request(noGateway).get('/api/checkout/config')).body.data;
    expect(config).toMatchObject({ cardPayments: false, international: { enabled: false } });
  });

  it('tài khoản nhận chuyển khoản: chưa nhập thì null', async () => {
    expect((await request(app).get('/api/shop/bank')).body.data).toBeNull();
  });

  it('kiểm tra mã: không tồn tại, hết hạn, chưa đủ giá trị tối thiểu', async () => {
    const list = (await request(app).get('/api/coupons').expect(200)).body.data;
    expect(list.map((coupon: { code: string }) => coupon.code).sort()).toEqual([
      'BAKUGAN200',
      'FREESHIP',
      'TDNEW10',
    ]);
    const apply = (code: string, subtotal: number) =>
      request(app).post('/api/coupons/apply').send({ code, subtotal });
    expect((await apply('freeship', 400_000).expect(200)).body.data.code).toBe('FREESHIP');
    expect((await apply('KHONGCO', 400_000).expect(404)).body.message).toBe(
      'Mã giảm giá không tồn tại hoặc đã hết hạn.',
    );
    expect((await apply('FREESHIP', 100_000).expect(422)).body.message).toBe(
      'Mã này áp dụng cho đơn từ 300.000₫.',
    );
    await database.db.insert(coupons).values({
      code: 'HETHAN',
      label: 'Mã cũ',
      type: 'amount',
      value: 10_000,
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect((await apply('hethan', 400_000).expect(410)).body.message).toBe(
      'Mã giảm giá đã hết hạn.',
    );
  });
});

describe('đặt hàng', () => {
  it('đặt COD: giá lấy từ CSDL, con chuyển SOLD, khách thấy đơn của mình', async () => {
    const feed = await postTestFeed(app, admin, 2);
    const [first, second] = feed.items;
    const res = await order(
      customer.auth,
      checkout([first!.id, second!.id], { note: 'Gọi trước khi giao' }),
    );
    const placed = res.body.data;
    expect(placed.code).toMatch(/^TD\d{4}[A-Z]\d{2}$/);
    expect(placed).toMatchObject({
      status: 'pending',
      paymentStatus: 'unpaid',
      source: 'web',
      subtotal: first!.price + second!.price,
      shippingFee: 30_000,
      total: first!.price + second!.price + 30_000,
      note: 'Gọi trước khi giao',
    });
    expect(placed.items.map((line: { code: string }) => line.code)).toEqual([
      first!.code,
      second!.code,
    ]);
    expect(placed.timeline[0]).toMatchObject({
      status: 'pending',
      actor: 'Khách hàng',
      note: 'Khách đặt trên web.',
    });
    expect(placed).not.toHaveProperty('internalNote');

    const [row] = await database.db.select().from(items).where(eq(items.id, first!.id));
    expect(row).toMatchObject({
      status: 'sold',
      soldVia: 'order',
      orderId: placed.id,
      feedTitleSnapshot: expect.any(String),
    });
    const publicFeed = (await request(app).get(`/api/feeds/${feed.number}`)).body.data;
    expect(publicFeed.status).toBe('sold-out');

    const mine = (await request(app).get('/api/orders/me').set(customer.auth).expect(200)).body
      .data;
    expect(mine.map((entry: { id: string }) => entry.id)).toContain(placed.id);
    const other = await signInAs(app, database, 'customer');
    await request(app).get(`/api/orders/me/${placed.id}`).set(other.auth).expect(404);
  });

  it('kiểm tra dữ liệu như web; admin không đặt hàng bằng tài khoản quản trị', async () => {
    const feed = await postTestFeed(app, admin, 1);
    const id = feed.items[0]!.id;
    expect((await order(customer.auth, checkout([]), 422)).body.message).toBe(
      'Giỏ hàng đang trống.',
    );
    expect((await order(customer.auth, checkout([id], { phone: '12345' }), 422)).body.message).toBe(
      'Số điện thoại người nhận chưa đúng (VD 0912345678).',
    );
    expect(
      (await order(customer.auth, checkout([id], { addressLine: 'Q1' }), 422)).body.message,
    ).toBe('Ghi rõ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.');
    expect(
      (await order(customer.auth, checkout([id], { shippingRegion: 'international' }), 422)).body
        .message,
    ).toBe('Đơn gửi ra nước ngoài chỉ thanh toán bằng thẻ Visa / Mastercard / JCB.');
    await order(admin, checkout([id]), 403);
    await request(app)
      .post('/api/orders')
      .send(checkout([id]))
      .expect(401);
  });

  it('con đã bán / feed chưa mở bán → 409 với câu như web', async () => {
    const feed = await postTestFeed(app, admin, 1);
    const id = feed.items[0]!.id;
    await order(customer.auth, checkout([id]));
    const again = await order(customer.auth, checkout([id]), 409);
    expect(again.body.message).toBe(
      `${feed.items[0]!.code} vừa có người chốt trước hoặc không còn trên feed. Bạn bỏ khỏi giỏ rồi đặt lại nhé.`,
    );
    const later = await postTestFeed(app, admin, 1, {
      opensAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    });
    const early = await order(customer.auth, checkout([later.items[0]!.id]), 409);
    expect(early.body.message).toBe(
      `Feed #${later.number} chưa tới giờ mở bán, bạn quay lại đúng giờ để chốt nhé.`,
    );
  });

  it('20 khách cùng chốt một con: đúng 1 đơn thành công', async () => {
    const feed = await postTestFeed(app, admin, 1);
    const id = feed.items[0]!.id;
    const buyers = await Promise.all(
      Array.from({ length: 20 }, () => signInAs(app, database, 'customer')),
    );
    const results = await Promise.all(
      buyers.map((buyer) =>
        request(app)
          .post('/api/orders')
          .set(buyer.auth)
          .send(checkout([id])),
      ),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(19);
    const sold = await database.db
      .select()
      .from(orders)
      .where(eq(orders.id, results.find((res) => res.status === 201)!.body.data.id));
    expect(sold).toHaveLength(1);
  });

  it('Idempotency-Key: gửi lại (kể cả cùng lúc) chỉ ra một đơn; khác nội dung → 422', async () => {
    const feed = await postTestFeed(app, admin, 2);
    const body = checkout([feed.items[0]!.id]);
    const key = `key-${newId()}`;
    const [a, b] = await Promise.all([
      request(app).post('/api/orders').set(customer.auth).set('Idempotency-Key', key).send(body),
      request(app).post('/api/orders').set(customer.auth).set('Idempotency-Key', key).send(body),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.data.id).toBe(b.body.data.id);
    const replay = await request(app)
      .post('/api/orders')
      .set(customer.auth)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    expect(replay.body.data.id).toBe(a.body.data.id);
    const changed = await request(app)
      .post('/api/orders')
      .set(customer.auth)
      .set('Idempotency-Key', key)
      .send(checkout([feed.items[1]!.id]))
      .expect(422);
    expect(changed.body.message).toContain('Idempotency-Key');
    const stored = await database.db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.idemKey, key));
    expect(stored).toHaveLength(1);
  });

  it('mã giảm giá: tính đúng, ghi lượt dùng; mã khách mới chỉ dùng đơn đầu; huỷ đơn thì trả lượt', async () => {
    const buyer = await signInAs(app, database, 'customer');
    const feed = await postTestFeed(app, admin, 5); // 200k, 300k, 400k, 500k, 600k
    const [p200, , p400, p500, p600] = feed.items;
    const usedCount = async () =>
      (await database.db.select().from(coupons).where(eq(coupons.code, 'TDNEW10')))[0]!.usedCount;
    const before = await usedCount();

    const placed = (
      await order(buyer.auth, checkout([p200!.id, p400!.id], { couponCode: 'tdnew10' }))
    ).body.data;
    expect(placed).toMatchObject({
      subtotal: 600_000,
      discount: 60_000,
      shippingFee: 30_000,
      total: 570_000,
    });
    expect(placed.timeline[0].note).toBe('Khách đặt trên web. Dùng mã TDNEW10.');
    expect(await usedCount()).toBe(before + 1);
    const second = await order(buyer.auth, checkout([p500!.id], { couponCode: 'TDNEW10' }), 422);
    expect(second.body.message).toBe('Mã này chỉ dành cho đơn đầu tiên của bạn.');

    const cancelled = await request(app)
      .post(`/api/orders/me/${placed.id}/cancel`)
      .set(buyer.auth)
      .expect(200);
    expect(cancelled.body.data).toMatchObject({
      status: 'cancelled',
      cancelReason: 'customer-request',
    });
    expect(await usedCount()).toBe(before);
    const [redemption] = await database.db
      .select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.orderId, placed.id));
    expect(redemption!.releasedAt).not.toBeNull();
    const [freed] = await database.db.select().from(items).where(eq(items.id, p200!.id));
    expect(freed).toMatchObject({ status: 'available', orderId: null });
    await request(app).post(`/api/orders/me/${placed.id}/cancel`).set(buyer.auth).expect(409);

    // Đơn đầu đã huỷ thì đơn sau vẫn là "đơn đầu tiên".
    const retry = await order(buyer.auth, checkout([p500!.id], { couponCode: 'TDNEW10' }));
    expect(retry.body.data.discount).toBe(50_000);
    await order(buyer.auth, checkout([p600!.id], { couponCode: 'TDNEW10' }), 422);
    // Mã miễn ship chỉ cho đơn trong nước — và chỉ áp dụng khi có phí ship.
    const free = await order(buyer.auth, checkout([p600!.id], { couponCode: 'FREESHIP' }));
    expect(free.body.data).toMatchObject({ shippingFee: 0, discount: 0, total: 600_000 });
  });
});

describe('admin xử lý đơn', () => {
  it('danh sách: đếm theo trạng thái, tìm không dấu, phân trang', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .query({ keyword: 'nguyen van khach', pageSize: 2 })
      .set(admin)
      .expect(200);
    const { page, counts } = res.body.data;
    expect(counts.all).toBeGreaterThan(2);
    expect(counts.all).toBe(
      ['pending', 'confirmed', 'packing', 'shipping', 'completed', 'cancelled', 'returned']
        .map((status) => counts[status] as number)
        .reduce((sum, value) => sum + value, 0),
    );
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(counts.all);
    await request(app).get('/api/admin/orders').set(customer.auth).expect(403);
  });

  it('ghi chú nội bộ để riêng: không đè ghi chú của khách, khách không thấy', async () => {
    const feed = await postTestFeed(app, admin, 1);
    const placed = (
      await order(customer.auth, checkout([feed.items[0]!.id], { note: 'Giao giờ hành chính' }))
    ).body.data;
    const res = await request(app)
      .patch(`/api/admin/orders/${placed.id}`)
      .set(admin)
      .send({ internalNote: 'Khách quen, gói kỹ' })
      .expect(200);
    expect(res.body.data).toMatchObject({
      note: 'Giao giờ hành chính',
      internalNote: 'Khách quen, gói kỹ',
    });
    const mine = (await request(app).get(`/api/orders/me/${placed.id}`).set(customer.auth)).body
      .data;
    expect(mine.note).toBe('Giao giờ hành chính');
    expect(mine).not.toHaveProperty('internalNote');
  });

  it('đổi trạng thái theo đúng bảng chuyển; hoàn tất COD thì đã trả; đủ 3 con lên Lv2', async () => {
    const buyer = await signInAs(app, database, 'customer');
    const feed = await postTestFeed(app, admin, 3);
    const placed = (await order(buyer.auth, checkout(feed.items.map((item) => item.id)))).body.data;
    const move = (status: string, extra: Record<string, unknown> = {}, expected = 200) =>
      request(app)
        .patch(`/api/admin/orders/${placed.id}/status`)
        .set(admin)
        .send({ status, ...extra })
        .expect(expected);
    expect((await move('completed', {}, 409)).body.message).toBe(
      'Không thể chuyển đơn sang trạng thái này từ trạng thái hiện tại.',
    );
    await move('confirmed', { note: 'Đã gọi khách' });
    await move('packing');
    await move('shipping', { note: 'Mã vận đơn GHN123' });
    const done = (await move('completed')).body.data;
    expect(done).toMatchObject({ status: 'completed', paymentStatus: 'paid' });
    expect(done.timeline.at(-1).actor).toBe('Chủ shop');
    // Khách thấy "TD Bakugan" thay cho tên nhân viên, vẫn thấy ghi chú bước (mã vận đơn).
    const mine = (await request(app).get(`/api/orders/me/${placed.id}`).set(buyer.auth)).body.data;
    expect(mine.timeline.map((event: { actor: string }) => event.actor)).toContain('TD Bakugan');
    expect(
      mine.timeline.some((event: { note?: string }) => event.note === 'Mã vận đơn GHN123'),
    ).toBe(true);
    const [user] = await database.db.select().from(users).where(eq(users.id, buyer.id));
    expect(user).toMatchObject({ memberLevel: 2, levelSource: 'purchases' });
    const audit = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetId, placed.id));
    expect(audit.length).toBeGreaterThanOrEqual(4);
  });

  it('huỷ phải có lý do; huỷ thì mở bán lại; hoàn hàng có chọn mở bán lại', async () => {
    const feed = await postTestFeed(app, admin, 2);
    const first = (await order(customer.auth, checkout([feed.items[0]!.id]))).body.data;
    const status = (orderId: string, body: Record<string, unknown>, expected = 200) =>
      request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set(admin)
        .send(body)
        .expect(expected);
    const noReason = await status(first.id, { status: 'cancelled' }, 422);
    expect(noReason.body.fieldErrors).toEqual({ cancelReason: 'Vui lòng chọn lý do huỷ đơn.' });
    await status(first.id, { status: 'cancelled', cancelReason: 'out-of-stock', note: 'Hàng lỗi' });
    const [freed] = await database.db.select().from(items).where(eq(items.id, feed.items[0]!.id));
    expect(freed!.status).toBe('available');

    const second = (await order(customer.auth, checkout([feed.items[1]!.id]))).body.data;
    for (const next of ['confirmed', 'packing', 'shipping'])
      await status(second.id, { status: next });
    await status(second.id, { status: 'returned', restock: true });
    const [back] = await database.db.select().from(items).where(eq(items.id, feed.items[1]!.id));
    expect(back!.status).toBe('available');
  });

  it('thanh toán: đánh dấu đã nhận tiền / hoàn tiền tay cho đơn không trả thẻ', async () => {
    const feed = await postTestFeed(app, admin, 1);
    const placed = (
      await order(customer.auth, checkout([feed.items[0]!.id], { paymentMethod: 'bank-transfer' }))
    ).body.data;
    const pay = (paymentStatus: string, expected = 200) =>
      request(app)
        .patch(`/api/admin/orders/${placed.id}/payment`)
        .set(admin)
        .send({ paymentStatus })
        .expect(expected);
    expect((await pay('refunded', 409)).body.message).toBe(
      'Đơn này chưa thanh toán nên không có gì để hoàn.',
    );
    expect((await pay('paid')).body.data.paymentStatus).toBe('paid');
    expect((await pay('refunded', 409)).body.message).toBe(
      'Chỉ hoàn tiền cho đơn đã huỷ hoặc đã hoàn hàng.',
    );
    await request(app)
      .patch(`/api/admin/orders/${placed.id}/status`)
      .set(admin)
      .send({ status: 'cancelled', cancelReason: 'customer-request' })
      .expect(200);
    const refunded = (await pay('refunded')).body.data;
    expect(refunded.paymentStatus).toBe('refunded');
    expect(refunded.timeline.at(-1).note).toBe('Đã hoàn tiền cho khách.');
  });

  it('tạo đơn tay: server tự tra từng con; chọn trùng / đã bán / khách lạ bị chặn', async () => {
    const feed = await postTestFeed(app, admin, 3);
    const [a, b, c] = feed.items;
    const body = (overrides: Record<string, unknown> = {}) => ({
      customerId: customer.id,
      receiverName: 'Trần Thị Mua',
      phone: '0987654321',
      addressLine: '45 Hồng Bàng, Phường 6, Quận 6, TP.HCM',
      items: [
        { itemId: a!.id, price: 150_000 },
        { itemId: b!.id, price: 0 },
      ],
      shippingFee: 30_000,
      discount: 500_000,
      paymentMethod: 'momo',
      paymentStatus: 'paid',
      initialStatus: 'confirmed',
      note: 'Chốt qua Messenger',
      ...overrides,
    });
    const created = (
      await request(app).post('/api/admin/orders').set(admin).send(body()).expect(201)
    ).body.data;
    expect(created).toMatchObject({
      source: 'manual',
      status: 'confirmed',
      subtotal: 150_000,
      discount: 180_000,
      total: 0,
      customerEmail: expect.stringContaining('@test.vn'),
    });
    expect(created.timeline.map((event: { status: string }) => event.status)).toEqual([
      'pending',
      'confirmed',
    ]);
    const twice = await request(app)
      .post('/api/admin/orders')
      .set(admin)
      .send(
        body({
          items: [
            { itemId: c!.id, price: 1 },
            { itemId: c!.id, price: 1 },
          ],
        }),
      )
      .expect(422);
    expect(twice.body.message).toBe(`${c!.code} bị chọn hai lần.`);
    const sold = await request(app)
      .post('/api/admin/orders')
      .set(admin)
      .send(body({ items: [{ itemId: a!.id, price: 1 }] }))
      .expect(409);
    expect(sold.body.message).toBe(`${a!.code} ${a!.name} đã bán rồi.`);
    await request(app)
      .post('/api/admin/orders')
      .set(admin)
      .send(body({ customerId: newId(), items: [{ itemId: c!.id, price: 1 }] }))
      .expect(422);
    await request(app)
      .post('/api/admin/orders')
      .set(admin)
      .send(body({ paymentMethod: 'card' }))
      .expect(422);
  });

  it('sự cố: mô tả quá ngắn bị chặn; đóng sự cố phải ghi cách xử lý', async () => {
    const feed = await postTestFeed(app, admin, 1);
    const placed = (await order(customer.auth, checkout([feed.items[0]!.id]))).body.data;
    const short = await request(app)
      .post('/api/admin/issues')
      .set(admin)
      .send({
        orderId: placed.id,
        type: 'late-delivery',
        description: 'trễ',
        reportedBy: 'customer',
      })
      .expect(422);
    expect(short.body.fieldErrors.description).toContain('ít nhất 10 ký tự');
    const issue = (
      await request(app)
        .post('/api/admin/issues')
        .set(admin)
        .send({
          orderId: placed.id,
          type: 'late-delivery',
          description: 'Khách báo giao trễ 3 ngày',
          reportedBy: 'customer',
        })
        .expect(201)
    ).body.data;
    expect(issue).toMatchObject({
      orderCode: placed.code,
      customerName: 'Nguyễn Văn Khách',
      status: 'open',
    });
    await request(app)
      .patch(`/api/admin/issues/${issue.id}`)
      .set(admin)
      .send({ status: 'resolved' })
      .expect(422);
    const resolved = (
      await request(app)
        .patch(`/api/admin/issues/${issue.id}`)
        .set(admin)
        .send({ status: 'resolved', resolution: 'Đã gọi bưu cục, giao bù' })
        .expect(200)
    ).body.data;
    expect(resolved).toMatchObject({ status: 'resolved', resolution: 'Đã gọi bưu cục, giao bù' });
    const list = (await request(app).get(`/api/admin/orders/${placed.id}/issues`).set(admin)).body
      .data;
    expect(list).toHaveLength(1);
  });
});

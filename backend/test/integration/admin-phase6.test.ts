import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { users } from '../../src/db/schema';
import { BOT_TOPIC_IDS } from '../../src/shared/types';
import {
  captureMailer,
  openTestDatabase,
  postTestFeed,
  signInAs,
  testApp,
  testEnv,
} from '../helpers';

let database: Database;
let app: ReturnType<typeof testApp>;
let admin: { id: string; auth: { Authorization: string } };
let customer: { id: string; email: string; auth: { Authorization: string } };
const mail = captureMailer();

beforeAll(async () => {
  database = await openTestDatabase();
  app = testApp(database, { env: testEnv({ CARD_GATEWAY: 'mock' }), mailer: mail.mailer });
  admin = await signInAs(app, database, 'admin');
  customer = await signInAs(app, database, 'customer', 'Đặng Văn Hạng');
  await database.db.update(users).set({ phone: '0911222333' }).where(eq(users.id, customer.id));
});

afterAll(async () => {
  await database.close();
});

describe('cài đặt shop và bot', () => {
  it('chỉ admin; kiểm tra từng ô như web; tắt thẻ thì tắt luôn giao quốc tế', async () => {
    await request(app).get('/api/admin/settings/shop').set(customer.auth).expect(403);
    const shop = (await request(app).get('/api/admin/settings/shop').set(admin.auth).expect(200))
      .body.data;
    expect(shop).toMatchObject({ cardPayments: false, international: { enabled: false } });

    const bad = await request(app)
      .patch('/api/admin/settings/shop')
      .set(admin.auth)
      .send({ bank: { bankName: 'VCB', accountNumber: '12ab', accountHolder: 'x' } })
      .expect(422);
    expect(bad.body.fieldErrors).toEqual({ accountNumber: 'Số tài khoản chỉ gồm 6–20 chữ số.' });

    const saved = (
      await request(app)
        .patch('/api/admin/settings/shop')
        .set(admin.auth)
        .send({
          bank: {
            bankName: 'Vietcombank',
            accountNumber: '0123 456 789',
            accountHolder: 'tran van shop',
          },
          cardPayments: true,
          international: { enabled: true, feeAsia: 300_000, feeWorld: 700_000, usdRate: 25_500 },
          memberDepositAmount: 400_000,
        })
        .expect(200)
    ).body.data;
    expect(saved.bank).toEqual({
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      accountHolder: 'TRAN VAN SHOP',
    });
    expect(saved.international).toMatchObject({ enabled: true, feeWorld: 700_000 });
    const config = (await request(app).get('/api/checkout/config')).body.data;
    expect(config).toMatchObject({
      cardPayments: true,
      international: { enabled: true, feeWorld: 700_000 },
    });
    expect((await request(app).get('/api/shop/bank')).body.data.accountNumber).toBe('0123456789');

    const off = (
      await request(app)
        .patch('/api/admin/settings/shop')
        .set(admin.auth)
        .send({ cardPayments: false })
        .expect(200)
    ).body.data;
    expect(off.international.enabled).toBe(false);
    const rate = await request(app)
      .patch('/api/admin/settings/shop')
      .set(admin.auth)
      .send({ international: { enabled: false, feeAsia: 1, feeWorld: 1, usdRate: 5 } })
      .expect(422);
    expect(rate.body.fieldErrors).toEqual({
      usdRate: 'Tỉ giá phải từ 1.000 đến 100.000₫ cho 1 USD.',
    });
  });

  it('bot: đủ 11 chủ đề, giới hạn độ dài từng ô', async () => {
    const current = (await request(app).get('/api/admin/settings/bot').set(admin.auth).expect(200))
      .body.data;
    expect(Object.keys(current.topics).sort()).toEqual([...BOT_TOPIC_IDS].sort());
    const { updatedAt: _updatedAt, ...body } = current;
    const missing = { ...body, topics: { ...body.topics } };
    delete missing.topics.promotions;
    await request(app).put('/api/admin/settings/bot').set(admin.auth).send(missing).expect(422);
    const tooLong = await request(app)
      .put('/api/admin/settings/bot')
      .set(admin.auth)
      .send({ ...body, extraKnowledge: 'x'.repeat(1_501) })
      .expect(422);
    expect(tooLong.body.fieldErrors.extraKnowledge).toBe('Ghi chú cho bot tối đa 1.500 ký tự.');
    const saved = (
      await request(app)
        .put('/api/admin/settings/bot')
        .set(admin.auth)
        .send({ ...body, enabled: false, greeting: 'Xin chào!' })
        .expect(200)
    ).body.data;
    expect(saved).toMatchObject({ enabled: false, greeting: 'Xin chào!' });
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(0);
  });
});

describe('hạng thành viên', () => {
  it('khách xem hạng, báo đã nạp tiền; mỗi lúc chỉ một yêu cầu; rút lại được', async () => {
    const info = (await request(app).get('/api/me/membership').set(customer.auth).expect(200)).body
      .data;
    expect(info).toMatchObject({
      level: 1,
      purchasedCount: 0,
      purchaseGoal: 3,
      depositAmount: 400_000,
      depositBalance: 0,
      transferNote: 'TDLV2 0911222333',
      bank: { bankName: 'Vietcombank' },
    });
    const deposit = (
      await request(app)
        .post('/api/me/membership/deposit')
        .set(customer.auth)
        .send({ message: 'Đã chuyển sáng nay' })
        .expect(201)
    ).body.data;
    expect(deposit.pendingRequest).toMatchObject({
      kind: 'deposit',
      amount: 400_000,
      status: 'pending',
      transferNote: 'TDLV2 0911222333',
    });
    const twice = await request(app)
      .post('/api/me/membership/review')
      .set(customer.auth)
      .send({ message: 'Khách quen của shop lâu năm' })
      .expect(409);
    expect(twice.body.message).toBe('Bạn đã có một yêu cầu đang chờ shop xử lý.');
    const cancelled = (
      await request(app).delete('/api/me/membership/request').set(customer.auth).expect(200)
    ).body.data;
    expect(cancelled.pendingRequest).toBeUndefined();
    const short = await request(app)
      .post('/api/me/membership/review')
      .set(customer.auth)
      .send({ message: 'cho em' })
      .expect(422);
    expect(short.body.fieldErrors).toEqual({ message: 'Viết ít nhất 10 ký tự.' });
    await request(app).post('/api/me/membership/deposit').set(admin.auth).send({}).expect(409);
  });

  it('admin duyệt yêu cầu nạp tiền: ghi nhận tiền nạp và lên Lv2; từ chối phải có lý do', async () => {
    const buyer = await signInAs(app, database, 'customer');
    const pending = (
      await request(app).post('/api/me/membership/deposit').set(buyer.auth).send({}).expect(201)
    ).body.data.pendingRequest;
    await request(app)
      .post(`/api/admin/membership-requests/${pending.id}/reject`)
      .set(admin.auth)
      .send({})
      .expect(422);
    const approved = (
      await request(app)
        .post(`/api/admin/membership-requests/${pending.id}/approve`)
        .set(admin.auth)
        .send({ note: 'Đã nhận tiền' })
        .expect(200)
    ).body.data;
    expect(approved).toMatchObject({
      status: 'approved',
      resolvedBy: 'Chủ shop',
      adminNote: 'Đã nhận tiền',
    });
    await request(app)
      .post(`/api/admin/membership-requests/${pending.id}/approve`)
      .set(admin.auth)
      .send({})
      .expect(409);
    const info = (await request(app).get('/api/me/membership').set(buyer.auth)).body.data;
    expect(info).toMatchObject({ level: 2, source: 'deposit', depositBalance: 400_000 });
    await request(app).post('/api/me/membership/deposit').set(buyer.auth).send({}).expect(409);
  });
});

describe('quản lý khách hàng', () => {
  it('danh sách có số liệu đơn; tìm không dấu; lọc khách có yêu cầu Lv2', async () => {
    const feed = await postTestFeed(app, admin.auth, 1);
    await request(app)
      .post('/api/orders')
      .set(customer.auth)
      .send({
        itemIds: [feed.items[0]!.id],
        receiverName: 'Đặng Văn Hạng',
        phone: '0911222333',
        addressLine: '1 Hồng Bàng, Phường 6, Quận 6, TP.HCM',
        paymentMethod: 'cod',
      })
      .expect(201);
    await request(app)
      .post('/api/me/membership/review')
      .set(customer.auth)
      .send({ message: 'Em mua ở shop nhiều lần rồi ạ' })
      .expect(201);

    const list = (
      await request(app)
        .get('/api/admin/customers')
        .query({ keyword: 'dang van hang' })
        .set(admin.auth)
        .expect(200)
    ).body.data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: customer.id,
      memberLevel: 1,
      stats: { orderCount: 1, totalSpent: feed.items[0]!.price + 30_000, purchasedItemCount: 0 },
      pendingLevelRequest: { kind: 'review' },
    });
    const requests = (
      await request(app).get('/api/admin/customers').query({ level: 'requests' }).set(admin.auth)
    ).body.data;
    expect(requests.map((entry: { id: string }) => entry.id)).toContain(customer.id);
    await request(app).get('/api/admin/customers').set(customer.auth).expect(403);
  });

  it('chi tiết: đơn, yêu cầu Lv2; liên kết ngân hàng không bao giờ có số tài khoản', async () => {
    await request(app)
      .put('/api/auth/me/bank-account')
      .set(customer.auth)
      .send({ bankName: 'ACB', accountNumber: '9876543210', accountHolder: 'DANG VAN HANG' })
      .expect(200);
    const res = await request(app)
      .get(`/api/admin/customers/${customer.id}`)
      .set(admin.auth)
      .expect(200);
    expect(res.body.data.bankLink).toEqual({ bankName: 'ACB', accountHolder: 'DANG VAN HANG' });
    expect(JSON.stringify(res.body)).not.toContain('9876543210');
    expect(JSON.stringify(res.body)).not.toContain('3210');
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.levelRequests[0]).toMatchObject({ kind: 'review', status: 'pending' });
  });

  it('đặt hạng trực tiếp đóng yêu cầu xét duyệt; sửa hồ sơ; email trùng → 409', async () => {
    await request(app)
      .patch(`/api/admin/customers/${customer.id}/level`)
      .set(admin.auth)
      .send({ level: 2, note: 'Khách quen' })
      .expect(200);
    const detail = (await request(app).get(`/api/admin/customers/${customer.id}`).set(admin.auth))
      .body.data;
    expect(detail).toMatchObject({ memberLevel: 2, levelSource: 'admin' });
    expect(detail.levelRequests[0]).toMatchObject({
      status: 'approved',
      resolvedBy: 'Chủ shop',
      adminNote: 'Khách quen',
    });
    await request(app)
      .patch(`/api/admin/customers/${admin.id}/level`)
      .set(admin.auth)
      .send({ level: 2 })
      .expect(404);

    const other = await signInAs(app, database, 'customer');
    const clash = await request(app)
      .patch(`/api/admin/customers/${customer.id}`)
      .set(admin.auth)
      .send({ fullName: 'Đặng Văn Hạng', email: other.email, phone: '', tags: [], adminNote: '' })
      .expect(409);
    expect(clash.body.fieldErrors).toEqual({ email: 'Email này đã thuộc về tài khoản khác.' });
    await request(app)
      .patch(`/api/admin/customers/${customer.id}`)
      .set(admin.auth)
      .send({
        fullName: 'Đặng Văn Hạng',
        email: customer.email,
        phone: '0911222333',
        tags: ['VIP', ' VIP ', 'Khách quen'],
        adminNote: 'Hay mua hệ Pyrus',
      })
      .expect(200);
    const updated = (await request(app).get(`/api/admin/customers/${customer.id}`).set(admin.auth))
      .body.data;
    expect(updated).toMatchObject({ tags: ['VIP', 'Khách quen'], adminNote: 'Hay mua hệ Pyrus' });
  });

  it('khoá tài khoản phải có lý do, đăng xuất khách ngay; không tự khoá / tự đổi quyền', async () => {
    const victim = await signInAs(app, database, 'customer');
    await request(app)
      .patch(`/api/admin/customers/${victim.id}/status`)
      .set(admin.auth)
      .send({ status: 'locked' })
      .expect(422);
    await request(app)
      .patch(`/api/admin/customers/${victim.id}/status`)
      .set(admin.auth)
      .send({ status: 'locked', reason: 'Bom hàng 3 lần' })
      .expect(200);
    await request(app).get('/api/auth/me').set(victim.auth).expect(401);
    const self = await request(app)
      .patch(`/api/admin/customers/${admin.id}/status`)
      .set(admin.auth)
      .send({ status: 'locked', reason: 'x' })
      .expect(409);
    expect(self.body.message).toBe('Bạn không thể tự khoá tài khoản của chính mình.');
    await request(app)
      .patch(`/api/admin/customers/${admin.id}/role`)
      .set(admin.auth)
      .send({ role: 'customer' })
      .expect(409);
    await request(app)
      .patch(`/api/admin/customers/${victim.id}/status`)
      .set(admin.auth)
      .send({ status: 'active' })
      .expect(200);
    const row = (await database.db.select().from(users).where(eq(users.id, victim.id)))[0]!;
    expect(row).toMatchObject({ status: 'active', lockedReason: null });
  });

  it('gửi email đặt lại mật khẩu (admin không tự đặt mật khẩu hộ)', async () => {
    const before = mail.sent.length;
    const res = await request(app)
      .post(`/api/admin/customers/${customer.id}/password-reset`)
      .set(admin.auth)
      .expect(200);
    expect(res.body.data.email).toBe(customer.email);
    expect(mail.sent.length).toBe(before + 1);
    expect(mail.sent.at(-1)!.to).toBe(customer.email);
  });
});

describe('tổng quan, báo cáo, số đếm menu', () => {
  it('tổng quan: doanh thu, đơn theo trạng thái, 14 ngày, feed, khách', async () => {
    const stats = (
      await request(app).get('/api/admin/dashboard').query({ days: 30 }).set(admin.auth).expect(200)
    ).body.data;
    expect(stats.rangeDays).toBe(30);
    expect(stats.orderCount).toBe(1);
    expect(stats.statusCounts.pending).toBe(1);
    expect(stats.revenue).toBeGreaterThan(0);
    expect(stats.daily).toHaveLength(14);
    expect(stats.daily.at(-1).revenue).toBe(stats.revenue);
    expect(stats).toMatchObject({ feedLimit: 30, soldItems: 1, pendingOrders: 1, openIssues: 0 });
    expect(stats.customerCount).toBeGreaterThanOrEqual(3);
    await request(app).get('/api/admin/dashboard').set(customer.auth).expect(403);
  });

  it('báo cáo huỷ đơn & sự cố; số đếm trên menu', async () => {
    const order = (await request(app).get('/api/orders/me').set(customer.auth)).body.data[0];
    await request(app).post(`/api/orders/me/${order.id}/cancel`).set(customer.auth).expect(200);
    const report = (
      await request(app).get('/api/admin/reports/problems').set(admin.auth).expect(200)
    ).body.data;
    expect(report.cancelled.map((entry: { id: string }) => entry.id)).toEqual([order.id]);
    expect(report.byReason['customer-request']).toBe(1);
    expect(report.cancelRate).toBe(1);
    const badges = (await request(app).get('/api/admin/badges').set(admin.auth).expect(200)).body
      .data;
    expect(badges).toMatchObject({
      activeOrders: 0,
      levelRequests: 0,
      feedLimitReached: false,
      awaitingAuctionOrders: 0,
      waitingChats: 0,
    });
  });
});

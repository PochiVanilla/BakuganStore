import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { addresses, bankAccounts, sessions, users } from '../../src/db/schema';
import { decryptSecret, sha256Hex } from '../../src/lib/crypto';
import { newId } from '../../src/lib/ids';
import { captureMailer, openTestDatabase, testApp, testEnv } from '../helpers';

let database: Database;
beforeAll(async () => {
  database = await openTestDatabase();
});
afterAll(async () => {
  await database.close();
});

const PASSWORD = 'MatKhau123';

function newCustomer(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Nguyễn Văn Khách',
    email: `khach.${newId().slice(-12)}@test.vn`,
    phone: '0912345678',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    agreeToTerms: true,
    ...overrides,
  };
}

/** Đăng ký + đăng nhập, trả về access token và cookie phiên. */
async function signedIn(app = testApp(database), remember = true) {
  const account = newCustomer();
  await request(app).post('/api/auth/register').send(account).expect(201);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: PASSWORD, rememberMe: remember })
    .expect(200);
  return {
    app,
    account,
    token: res.body.data.accessToken as string,
    cookie: refreshCookie(res),
    res,
  };
}

/**
 * Cookie phiên có cờ Secure (web thử chạy https), nên trình duyệt / supertest qua http không tự gửi.
 * Test lấy cookie từ Set-Cookie rồi gửi tường minh.
 */
function refreshCookie(res: request.Response): string {
  const value = /td_rt=([^;]+)/.exec(String(res.headers['set-cookie']))?.[1];
  if (!value) throw new Error('Không có cookie td_rt');
  return `td_rt=${value}`;
}

describe('đăng ký', () => {
  it('tạo tài khoản khách Lv1; email trùng (kể cả khác hoa thường) → 409 ở ô email', async () => {
    const app = testApp(database);
    const account = newCustomer();
    const res = await request(app).post('/api/auth/register').send(account);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ email: account.email });
    const [row] = await database.db.select().from(users).where(eq(users.email, account.email));
    expect(row).toMatchObject({ role: 'customer', memberLevel: 1, status: 'active' });
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);

    const again = await request(app)
      .post('/api/auth/register')
      .send({ ...account, email: account.email.toUpperCase() });
    expect(again.status).toBe(409);
    expect(again.body.fieldErrors).toEqual({ email: 'Email này đã được đăng ký.' });
  });

  it('dữ liệu sai → 422 kèm lỗi từng ô, dùng đúng luật form của web', async () => {
    const res = await request(testApp(database))
      .post('/api/auth/register')
      .send(newCustomer({ password: 'yeu', confirmPassword: 'khac', phone: '123' }));
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.fieldErrors)).toEqual(
      expect.arrayContaining(['password', 'phone']),
    );
  });
});

describe('đăng nhập và phiên', () => {
  it('đúng mật khẩu: trả user + access token; refresh token chỉ nằm trong cookie httpOnly', async () => {
    const { res, account } = await signedIn();
    expect(res.body.data.user).toMatchObject({
      email: account.email,
      role: 'customer',
      memberLevel: 1,
    });
    expect(res.body.data.refreshToken).toBeUndefined();
    const body = JSON.stringify(res.body);
    for (const secret of ['passwordHash', 'adminNote', 'tags', 'failedLogins']) {
      expect(body).not.toContain(secret);
    }
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/td_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('sai mật khẩu hay email không có: cùng một câu 401, không lộ email nào đã đăng ký', async () => {
    const { app, account } = await signedIn();
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'SaiMatKhau9', rememberMe: false });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khong.ai@test.vn', password: 'SaiMatKhau9', rememberMe: false });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('sai 5 lần liền thì khoá đăng nhập tạm (đúng mật khẩu cũng chờ)', async () => {
    const { app, account } = await signedIn();
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: account.email, password: 'SaiMatKhau9', rememberMe: false })
        .expect(401);
    }
    const blocked = await request(testApp(database))
      .post('/api/auth/login')
      .send({ email: account.email, password: PASSWORD, rememberMe: false });
    expect(blocked.status).toBe(429);
  });

  it('GET /auth/me: có token thì trả hồ sơ, không có / token giả → 401', async () => {
    const { app, token, account } = await signedIn();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(account.email);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const forged = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer abc.def.ghi');
    expect(forged.status).toBe(401);
  });

  it('gia hạn phiên: đổi refresh token mới; dùng lại token cũ sau thời gian chờ → thu hồi cả chuỗi', async () => {
    const { app, cookie } = await signedIn();
    const renewed = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(renewed.status).toBe(200);
    expect(renewed.body.data.accessToken).toEqual(expect.any(String));
    const nextCookie = refreshCookie(renewed);
    expect(nextCookie).not.toBe(cookie);

    // Giả lập token cũ đã bị thay từ 1 phút trước (quá thời gian chờ 30 giây của hai tab).
    const oldHash = sha256Hex(cookie.slice('td_rt='.length));
    await database.db
      .update(sessions)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(eq(sessions.tokenHash, oldHash));
    const reused = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(reused.status).toBe(401);
    // Cả token mới (cùng chuỗi) và access token mới cũng bị thu hồi.
    expect((await request(app).post('/api/auth/refresh').set('Cookie', nextCookie)).status).toBe(
      401,
    );
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${renewed.body.data.accessToken}`);
    expect(me.status).toBe(401);
  });

  it('không có cookie hoặc cookie lạ → 401', async () => {
    const app = testApp(database);
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
    expect(
      (await request(app).post('/api/auth/refresh').set('Cookie', 'td_rt=gia-mao')).status,
    ).toBe(401);
  });

  it('hai tab gia hạn cùng lúc (trong 30 giây) vẫn được, không bị đăng xuất', async () => {
    const { app, cookie } = await signedIn();
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    const second = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers['set-cookie']).toBeUndefined();
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${second.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('đăng xuất: thu hồi phiên, access token cũ hết dùng được ngay', async () => {
    const { app, token, cookie } = await signedIn();
    const out = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect(String(out.headers['set-cookie'])).toMatch(/td_rt=;/);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('tài khoản bị khoá: đăng nhập 423, token đang có → 403', async () => {
    const { app, token, account } = await signedIn();
    await database.db.update(users).set({ status: 'locked' }).where(eq(users.email, account.email));
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(403);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: PASSWORD, rememberMe: false });
    expect(login.status).toBe(423);
  });
});

describe('hồ sơ và mật khẩu', () => {
  it('sửa hồ sơ; email đã có người dùng → 409', async () => {
    const a = await signedIn();
    const b = await signedIn();
    const ok = await request(a.app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ fullName: 'Trần Thị Mới', email: a.account.email, phone: '0987654321' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ fullName: 'Trần Thị Mới', phone: '0987654321' });
    const taken = await request(a.app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ fullName: 'Trần Thị Mới', email: b.account.email, phone: '0987654321' });
    expect(taken.status).toBe(409);
    expect(taken.body.fieldErrors.email).toBeDefined();
  });

  it('đổi mật khẩu: sai mật khẩu cũ → 422 (không phải 401); đúng thì các phiên khác bị thu hồi', async () => {
    const { app, token, account } = await signedIn();
    const other = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: PASSWORD, rememberMe: false });
    const otherToken = other.body.data.accessToken as string;

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'SaiMatKhau9',
        newPassword: 'MoiMoi1234',
        confirmNewPassword: 'MoiMoi1234',
      });
    expect(wrong.status).toBe(422);
    expect(wrong.body.fieldErrors.currentPassword).toBeDefined();

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'MoiMoi1234',
        confirmNewPassword: 'MoiMoi1234',
      })
      .expect(200);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(200);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${otherToken}`)).status,
    ).toBe(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'MoiMoi1234', rememberMe: false })
      .expect(200);
  });

  it('quên mật khẩu: cùng một câu trả lời; có tài khoản thì gửi link; link dùng một lần', async () => {
    const capture = captureMailer();
    const app = testApp(database, { mailer: capture.mailer });
    const { account, token } = await signedIn(app);

    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'khong.ai@test.vn' });
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: account.email });
    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(capture.sent).toHaveLength(1);
    expect(capture.sent[0]!.to).toBe(account.email);
    const link = /https:\/\/shop\.test\/dat-lai-mat-khau\?token=(\S+)/.exec(capture.sent[0]!.text);
    expect(link).not.toBeNull();
    const resetToken = link![1]!;

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'DatLai12345', confirmPassword: 'DatLai12345' });
    expect(reset.status).toBe(200);
    expect(reset.body.data).toEqual({ email: account.email });
    const again = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'DatLai12345', confirmPassword: 'DatLai12345' });
    expect(again.status).toBe(422);
    // Phiên cũ bị thu hồi, mật khẩu mới dùng được.
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'DatLai12345', rememberMe: false })
      .expect(200);
  });
});

describe('tài khoản nhận hoàn tiền', () => {
  it('lưu mã hoá; API chỉ trả 4 số cuối, kể cả cho chính chủ', async () => {
    const { app, token, account } = await signedIn();
    const res = await request(app)
      .put('/api/auth/me/bank-account')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bankName: 'Vietcombank',
        accountNumber: '0123456789',
        accountHolder: 'NGUYEN VAN KHACH',
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      bankName: 'Vietcombank',
      accountHolder: 'NGUYEN VAN KHACH',
      accountNumber: '•••• 6789',
    });
    const [user] = await database.db.select().from(users).where(eq(users.email, account.email));
    const [row] = await database.db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, user!.id));
    expect(row!.accountNumberEnc).not.toContain('0123456789');
    expect(decryptSecret(row!.accountNumberEnc, testEnv().bankDataKey)).toBe('0123456789');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(me.body)).not.toContain('0123456789');
    await request(app)
      .delete('/api/auth/me/bank-account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(after.body.data.bankAccount).toBeUndefined();
  });
});

describe('sổ địa chỉ', () => {
  const address = (overrides: Record<string, unknown> = {}) => ({
    label: 'Nhà riêng',
    receiverName: 'Nguyễn Văn Khách',
    phone: '0912345678',
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 6',
    ward: 'Phường 8',
    street: '633/12/19 Hồng Bàng',
    isDefault: false,
    ...overrides,
  });

  it('luôn đúng một địa chỉ mặc định; địa chỉ của người khác → 404', async () => {
    const { app, token } = await signedIn();
    const auth = { Authorization: `Bearer ${token}` };
    const first = await request(app).post('/api/addresses').set(auth).send(address());
    expect(first.status).toBe(201);
    const second = await request(app)
      .post('/api/addresses')
      .set(auth)
      .send(address({ label: 'Công ty', isDefault: true }));
    const read = async () =>
      (await request(app).get('/api/auth/me').set(auth)).body.data.addresses as Array<{
        id: string;
        isDefault: boolean;
      }>;
    let list = await read();
    expect(list.filter((item) => item.isDefault).map((item) => item.id)).toEqual([
      second.body.data.id,
    ]);

    await request(app).patch(`/api/addresses/${first.body.data.id}/default`).set(auth).expect(200);
    list = await read();
    expect(list.filter((item) => item.isDefault).map((item) => item.id)).toEqual([
      first.body.data.id,
    ]);

    await request(app).delete(`/api/addresses/${first.body.data.id}`).set(auth).expect(200);
    list = await read();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: second.body.data.id, isDefault: true });

    const stranger = await signedIn(app);
    const other = await request(app)
      .put(`/api/addresses/${second.body.data.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send(address());
    expect(other.status).toBe(404);
    const rows = await database.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, second.body.data.id));
    expect(rows[0]?.label).toBe('Công ty');
  });

  it('chưa đăng nhập → 401; tối đa 10 địa chỉ', async () => {
    const { app, token } = await signedIn();
    expect((await request(app).post('/api/addresses').send(address())).status).toBe(401);
    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(address())
        .expect(201);
    }
    const eleventh = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(address());
    expect(eleventh.status).toBe(422);
  });
});

describe('token hỏng không chặn việc gia hạn phiên', () => {
  it('gửi kèm access token hết hạn khi gọi /auth/refresh vẫn gia hạn được bằng cookie', async () => {
    const { app, cookie } = await signedIn();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', 'Bearer token.het.han')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const other = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token.het.han');
    expect(other.status).toBe(401);
  });
});

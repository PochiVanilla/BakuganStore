import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { inject } from 'vitest';
import { createApp, type AppContext } from '../src/app';
import { loadEnv, type Env } from '../src/config/env';
import { createDatabase, type Database } from '../src/db/client';
import { prepareDatabase } from '../src/db/migrate';
import { createLogger } from '../src/lib/logger';
import { sessions, settings, users } from '../src/db/schema';
import { randomToken, sha256Hex } from '../src/lib/crypto';
import { newId } from '../src/lib/ids';
import { hashPassword } from '../src/lib/password';
import type { Mailer, MailMessage } from '../src/mail';
import { signAccessToken } from '../src/modules/auth/tokens';
import { INITIAL_SHOP_SETTINGS } from '../src/shared/defaults';
import type { ShopSettings } from '../src/shared/types';

export const silentLogger = createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' });

export const TEST_ORIGIN = 'https://shop.test';

/**
 * Mỗi file test dùng một CSDL riêng (tạo ở openTestDatabase), để các file không đụng dữ liệu
 * của nhau (số feed, mã BK, mã giảm giá, cài đặt shop…) dù chạy theo thứ tự nào.
 * Vitest nạp lại file này cho từng file test nên mỗi file có một tên riêng.
 */
const FILE_DB_SUFFIX = randomBytes(4).toString('hex');

function fileDatabaseName(): string {
  return `${inject('mysql').database}_${FILE_DB_SUFFIX}`;
}

export function testEnv(overrides: Record<string, string> = {}): Env {
  const mysql = inject('mysql');
  return loadEnv({
    NODE_ENV: 'test',
    PUBLIC_ORIGIN: TEST_ORIGIN,
    DB_HOST: mysql.host,
    DB_PORT: String(mysql.port),
    DB_USER: mysql.user,
    DB_PASSWORD: mysql.password,
    DB_NAME: fileDatabaseName(),
    // Khoá cố định cho test (không phải khoá thật), để mọi app trong một test dùng chung.
    JWT_SECRET: 'khoa-ky-token-chi-dung-cho-test-0123456789',
    BANK_DATA_KEY: Buffer.alloc(32, 7).toString('base64'),
    ...overrides,
  });
}

/** Mở CSDL test đã chạy đủ migration + dữ liệu ban đầu (gọi nhiều lần vẫn an toàn). */
export async function openTestDatabase(env: Env = testEnv()): Promise<Database> {
  const mysqlInfo = inject('mysql');
  const admin = await mysql.createConnection({
    host: mysqlInfo.host,
    port: mysqlInfo.port,
    user: mysqlInfo.user,
    password: mysqlInfo.password,
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  await admin.end();
  const database = createDatabase(env);
  await prepareDatabase(database, silentLogger);
  return database;
}

export function testApp(
  database: Database,
  options: Partial<Omit<AppContext, 'database' | 'logger'>> = {},
) {
  return createApp({ env: options.env ?? testEnv(), logger: silentLogger, database, ...options });
}

/** Mailer giả: ghi lại thư thay vì gửi. */
export function captureMailer(): { mailer: Mailer; sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    mailer: {
      async send(message) {
        sent.push(message);
      },
    },
  };
}

export const TEST_PASSWORD = 'MatKhau123';

let passwordHash: Promise<string> | undefined;

/**
 * Tạo thẳng một tài khoản và một phiên đăng nhập trong CSDL (admin không đăng ký qua web được;
 * đi qua trang đăng nhập thì vướng giới hạn 10 lần / phút khi test cần nhiều khách).
 * Trả về header Authorization để gửi kèm request. Luồng đăng nhập thật có test riêng (auth.test.ts).
 */
export async function signInAs(
  _app: ReturnType<typeof testApp>,
  database: Database,
  role: 'admin' | 'customer',
  fullName = role === 'admin' ? 'Chủ shop' : 'Khách thử',
): Promise<{ id: string; email: string; auth: { Authorization: string } }> {
  const id = newId();
  const email = `${role}.${id.slice(-12)}@test.vn`;
  passwordHash ??= hashPassword(TEST_PASSWORD);
  await database.db.insert(users).values({
    id,
    email,
    passwordHash: await passwordHash,
    fullName,
    role,
    tags: [],
  });
  const sessionId = newId();
  await database.db.insert(sessions).values({
    id: sessionId,
    userId: id,
    familyId: newId(),
    tokenHash: sha256Hex(randomToken()),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  });
  const token = await signAccessToken({ userId: id, sessionId }, testEnv().jwtSecret);
  return { id, email, auth: { Authorization: `Bearer ${token}` } };
}

type TestApp = ReturnType<typeof testApp>;

/** Admin đăng một feed có `count` con (không ảnh), trả về feed như admin thấy. */
export async function postTestFeed(
  app: TestApp,
  admin: { Authorization: string },
  count: number,
  overrides: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post('/api/admin/feeds')
    .set(admin)
    .send({
      title: `Lô thử ${newId().slice(-6)}`,
      caption: '',
      images: [],
      items: Array.from({ length: count }, (_, index) => ({
        name: `Bakugan thử ${index + 1}`,
        price: 200_000 + index * 100_000,
        attribute: 'Pyrus',
      })),
      ...overrides,
    })
    .expect(201);
  return res.body.data as {
    id: string;
    number: number;
    items: Array<{ id: string; code: string; price: number; name: string }>;
  };
}

/** Sửa cài đặt shop trong CSDL (trang Cài đặt của admin làm ở giai đoạn sau). */
export async function setShopSettings(
  database: Database,
  patch: Partial<ShopSettings>,
): Promise<void> {
  await database.db
    .insert(settings)
    .values({ name: 'shop', value: { ...INITIAL_SHOP_SETTINGS, ...patch } })
    .onDuplicateKeyUpdate({ set: { value: { ...INITIAL_SHOP_SETTINGS, ...patch } } });
}

import request from 'supertest';
import { inject } from 'vitest';
import { createApp, type AppContext } from '../src/app';
import { loadEnv, type Env } from '../src/config/env';
import { createDatabase, type Database } from '../src/db/client';
import { prepareDatabase } from '../src/db/migrate';
import { createLogger } from '../src/lib/logger';
import { users } from '../src/db/schema';
import { newId } from '../src/lib/ids';
import { hashPassword } from '../src/lib/password';
import type { Mailer, MailMessage } from '../src/mail';

export const silentLogger = createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' });

export const TEST_ORIGIN = 'https://shop.test';

export function testEnv(overrides: Record<string, string> = {}): Env {
  const mysql = inject('mysql');
  return loadEnv({
    NODE_ENV: 'test',
    PUBLIC_ORIGIN: TEST_ORIGIN,
    DB_HOST: mysql.host,
    DB_PORT: String(mysql.port),
    DB_USER: mysql.user,
    DB_PASSWORD: mysql.password,
    DB_NAME: mysql.database,
    // Khoá cố định cho test (không phải khoá thật), để mọi app trong một test dùng chung.
    JWT_SECRET: 'khoa-ky-token-chi-dung-cho-test-0123456789',
    BANK_DATA_KEY: Buffer.alloc(32, 7).toString('base64'),
    ...overrides,
  });
}

/** Mở CSDL test đã chạy đủ migration + dữ liệu ban đầu (gọi nhiều lần vẫn an toàn). */
export async function openTestDatabase(env: Env = testEnv()): Promise<Database> {
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

/**
 * Tạo thẳng một tài khoản trong CSDL (admin không đăng ký qua web được) rồi đăng nhập,
 * trả về header Authorization để gửi kèm request.
 */
export async function signInAs(
  app: ReturnType<typeof testApp>,
  database: Database,
  role: 'admin' | 'customer',
  fullName = role === 'admin' ? 'Chủ shop' : 'Khách thử',
): Promise<{ id: string; email: string; auth: { Authorization: string } }> {
  const id = newId();
  const email = `${role}.${id.slice(-12)}@test.vn`;
  await database.db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(TEST_PASSWORD),
    fullName,
    role,
    tags: [],
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD, rememberMe: false })
    .expect(200);
  return { id, email, auth: { Authorization: `Bearer ${res.body.data.accessToken as string}` } };
}

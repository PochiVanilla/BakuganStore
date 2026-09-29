import { inject } from 'vitest';
import { createApp, type AppContext } from '../src/app';
import { loadEnv, type Env } from '../src/config/env';
import { createDatabase, type Database } from '../src/db/client';
import { prepareDatabase } from '../src/db/migrate';
import { createLogger } from '../src/lib/logger';

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

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import mysql from 'mysql2/promise';
import type { TestProject } from 'vitest/node';

/*
 * Test chạy trên MySQL thật (không dùng CSDL giả). Mỗi lần chạy tạo một CSDL trống
 * tên `tdbakugan_test`, chạy xong thì xoá. Cần tài khoản root (có quyền tạo CSDL).
 *
 * Máy lập trình: bật MySQL bằng `docker compose up -d` trong backend/, điền
 * DB_ROOT_PASSWORD trong backend/.env rồi chỉ cần `npm test`.
 * Nơi khác (VD máy chủ CI): đặt biến TEST_MYSQL_URL=mysql://root:<mật khẩu>@<host>:<cổng>.
 */

/** Đọc riêng vài biến cần cho test từ backend/.env (không nạp cả file vào process.env). */
function fromDotEnv(): Record<string, string | undefined> {
  const file = fileURLToPath(new URL('../.env', import.meta.url));
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

function testMysqlUrl(): string | undefined {
  if (process.env.TEST_MYSQL_URL) return process.env.TEST_MYSQL_URL;
  const env = fromDotEnv();
  if (env.TEST_MYSQL_URL) return env.TEST_MYSQL_URL;
  if (!env.DB_ROOT_PASSWORD) return undefined;
  const host = env.DB_HOST || '127.0.0.1';
  const port = env.DB_PORT || '3307';
  return `mysql://root:${encodeURIComponent(env.DB_ROOT_PASSWORD)}@${host}:${port}`;
}
export const TEST_DB_NAME = 'tdbakugan_test';

/**
 * Xoá CSDL test chung và các CSDL riêng của từng file test (tdbakugan_test_<mã>),
 * kể cả bản sót lại khi lần chạy trước bị ngắt giữa chừng.
 */
async function dropTestDatabases(connection: mysql.Connection): Promise<void> {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA
     WHERE SCHEMA_NAME = ? OR SCHEMA_NAME LIKE ?`,
    [TEST_DB_NAME, `${TEST_DB_NAME}\\_%`],
  );
  for (const row of rows) {
    await connection.query(`DROP DATABASE IF EXISTS \`${String(row.name)}\``);
  }
}

export interface TestMysql {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    mysql: TestMysql;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const url = testMysqlUrl();
  if (!url) {
    throw new Error(
      'Chưa biết MySQL để chạy test: điền DB_ROOT_PASSWORD trong backend/.env (và bật MySQL bằng ' +
        '`docker compose up -d` trong backend/), hoặc đặt biến TEST_MYSQL_URL.',
    );
  }
  const parsed = new URL(url);
  let admin: mysql.Connection;
  try {
    admin = await mysql.createConnection({ uri: url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const where = `${parsed.hostname}:${parsed.port || 3306}`;
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
      throw new Error(
        `Không kết nối được MySQL ở ${where}. Bật MySQL chưa? (trong backend/: docker compose up -d)`,
      );
    }
    if (code === 'ER_ACCESS_DENIED_ERROR') {
      throw new Error(
        `MySQL ở ${where} từ chối tài khoản root: kiểm tra DB_ROOT_PASSWORD trong backend/.env.`,
      );
    }
    throw error;
  }
  await dropTestDatabases(admin);
  await admin.query(
    `CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  await admin.end();

  project.provide('mysql', {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: TEST_DB_NAME,
  });

  return async () => {
    const cleanup = await mysql.createConnection({ uri: url });
    await dropTestDatabases(cleanup);
    await cleanup.end();
  };
}

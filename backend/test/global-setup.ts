import mysql from 'mysql2/promise';
import type { TestProject } from 'vitest/node';

/*
 * Test chạy trên MySQL thật (không dùng CSDL giả). Mỗi lần chạy tạo một CSDL trống
 * tên `tdbakugan_test`, chạy xong thì xoá. Cần một tài khoản có quyền tạo CSDL:
 *
 *   docker run -d --name tdb-mysql-test -e MYSQL_ROOT_PASSWORD=<mật khẩu> \
 *     -p 127.0.0.1:3307:3306 mysql:8.4
 *   TEST_MYSQL_URL=mysql://root:<mật khẩu>@127.0.0.1:3307 npm test
 */
export const TEST_DB_NAME = 'tdbakugan_test';

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
  const url = process.env.TEST_MYSQL_URL;
  if (!url) {
    throw new Error(
      'Chưa đặt TEST_MYSQL_URL. Ví dụ: TEST_MYSQL_URL=mysql://root:<mật khẩu>@127.0.0.1:3307 npm test ' +
        '(hướng dẫn bật MySQL để test ở đầu file test/global-setup.ts).',
    );
  }
  const parsed = new URL(url);
  const admin = await mysql.createConnection({ uri: url });
  await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
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
    await cleanup.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
    await cleanup.end();
  };
}

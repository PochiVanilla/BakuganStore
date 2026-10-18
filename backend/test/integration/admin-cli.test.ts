import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { users } from '../../src/db/schema';
import { newId } from '../../src/lib/ids';
import { openTestDatabase, testApp, testEnv } from '../helpers';

let database: Database;
beforeAll(async () => {
  database = await openTestDatabase();
});
afterAll(async () => {
  await database.close();
});

const backendDir = fileURLToPath(new URL('../..', import.meta.url));

/** Chạy `cli.ts admin:create`, gõ sẵn từng dòng vào stdin. */
function runAdminCreate(lines: string[]): Promise<{ code: number | null; output: string }> {
  const env = testEnv();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'admin:create'], {
      cwd: backendDir,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        PUBLIC_ORIGIN: env.PUBLIC_ORIGIN,
        DB_HOST: env.DB_HOST,
        DB_PORT: String(env.DB_PORT),
        DB_USER: env.DB_USER,
        DB_PASSWORD: env.DB_PASSWORD,
        DB_NAME: env.DB_NAME,
      },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
    child.stdin.end(`${lines.join('\n')}\n`);
  });
}

describe('lệnh admin:create', () => {
  it('tạo tài khoản quản trị, mật khẩu không hiện ra; đăng nhập được và vào được quyền admin', async () => {
    const email = `admin.${newId().slice(-10)}@test.vn`;
    const { code, output } = await runAdminCreate([
      email,
      'Chủ Shop TD',
      'QuanTri2026',
      'QuanTri2026',
    ]);
    expect(output).toContain('Đã tạo tài khoản quản trị');
    expect(code).toBe(0);
    expect(output).not.toContain('QuanTri2026');
    const [row] = await database.db.select().from(users).where(eq(users.email, email));
    expect(row?.role).toBe('admin');

    const login = await request(testApp(database))
      .post('/api/auth/login')
      .send({ email, password: 'QuanTri2026', rememberMe: false });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('admin');
  }, 60_000);

  it('mật khẩu yếu thì hỏi lại; nhập lại không khớp thì không tạo', async () => {
    const email = `admin.${newId().slice(-10)}@test.vn`;
    const { code, output } = await runAdminCreate([
      email,
      'Chủ Shop TD',
      'yeu',
      'QuanTri2026',
      'Khac2026Ab',
    ]);
    expect(output).toContain('Mật khẩu phải có ít nhất 8 ký tự');
    expect(code).toBe(1);
    const rows = await database.db.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  }, 60_000);
});

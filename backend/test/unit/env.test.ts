import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/config/env';

const BASE = {
  PUBLIC_ORIGIN: 'https://tdbakugan.vn',
  DB_HOST: 'mysql',
  DB_USER: 'tdb',
  DB_PASSWORD: 'mat-khau-bi-mat',
  DB_NAME: 'tdbakugan',
};
/** Bản thật bắt buộc có khoá ký token và khoá mã hoá số tài khoản. */
const PROD = {
  ...BASE,
  NODE_ENV: 'production',
  JWT_SECRET: 'k'.repeat(40),
  BANK_DATA_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('loadEnv', () => {
  it('điền giá trị mặc định', () => {
    const env = loadEnv({ ...BASE });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.DB_PORT).toBe(3306);
    expect(env.DB_MIGRATE_ON_START).toBe(true);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(env.allowedOrigins).toEqual(['https://tdbakugan.vn']);
  });

  it('bản thật mặc định tin đúng một lớp proxy (Caddy)', () => {
    expect(loadEnv({ ...PROD }).TRUST_PROXY_HOPS).toBe(1);
    expect(loadEnv({ ...PROD, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS).toBe(0);
  });

  it('log dễ đọc khi lập trình, JSON khi chạy thật (đổi được bằng LOG_FORMAT)', () => {
    expect(loadEnv({ ...BASE }).LOG_FORMAT).toBe('pretty');
    expect(loadEnv({ ...PROD }).LOG_FORMAT).toBe('json');
    expect(loadEnv({ ...BASE, NODE_ENV: 'test' }).LOG_FORMAT).toBe('json');
    expect(loadEnv({ ...BASE, LOG_FORMAT: 'json' }).LOG_FORMAT).toBe('json');
  });

  it('đọc danh sách origin thêm và bỏ dấu / cuối', () => {
    const env = loadEnv({
      ...BASE,
      PUBLIC_ORIGIN: 'https://tdbakugan.vn/',
      EXTRA_ORIGINS: 'http://localhost:3000, http://localhost:4173',
    });
    expect(env.allowedOrigins).toEqual([
      'https://tdbakugan.vn',
      'http://localhost:3000',
      'http://localhost:4173',
    ]);
  });

  it('biến để trống coi như chưa đặt (GEMINI_API_KEY= không tính là có khoá)', () => {
    expect(loadEnv({ ...BASE, GEMINI_API_KEY: '' }).GEMINI_API_KEY).toBeUndefined();
    expect(loadEnv({ ...BASE, GEMINI_API_KEY: '   ' }).GEMINI_API_KEY).toBeUndefined();
  });

  it('thiếu hoặc sai biến: báo tên biến, không in giá trị', () => {
    let caught: unknown;
    try {
      loadEnv({ ...BASE, DB_PASSWORD: undefined, PORT: 'abc', PUBLIC_ORIGIN: 'khong-phai-url' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvError);
    const message = (caught as EnvError).message;
    expect(message).toContain('DB_PASSWORD');
    expect(message).toContain('PORT');
    expect(message).toContain('PUBLIC_ORIGIN');
    expect(message).not.toContain('khong-phai-url');
    expect(message).not.toContain('mat-khau-bi-mat');
  });

  it('bản thật thiếu khoá ký token / khoá mã hoá thì không khởi động; khoá phải đủ 32 byte', () => {
    expect(() => loadEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET[\s\S]*BANK_DATA_KEY/,
    );
    expect(() => loadEnv({ ...PROD, BANK_DATA_KEY: 'ngan' })).toThrow(/BANK_DATA_KEY/);
    expect(loadEnv({ ...PROD }).generatedSecrets).toEqual([]);
  });

  it('khi lập trình chưa đặt khoá thì tạo khoá tạm và báo tên khoá thiếu', () => {
    const env = loadEnv({ ...BASE });
    expect(env.generatedSecrets).toEqual(['JWT_SECRET', 'BANK_DATA_KEY']);
    expect(env.bankDataKey).toHaveLength(32);
  });

  it('MAIL_DRIVER=smtp thì bắt buộc có máy chủ, tài khoản, mật khẩu SMTP', () => {
    expect(() => loadEnv({ ...BASE, MAIL_DRIVER: 'smtp' })).toThrow(/SMTP_HOST/);
    expect(
      loadEnv({
        ...BASE,
        MAIL_DRIVER: 'smtp',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'a',
        SMTP_PASS: 'b',
      }).SMTP_PORT,
    ).toBe(587);
  });

  it('tên CSDL chỉ gồm chữ, số và dấu _', () => {
    expect(() => loadEnv({ ...BASE, DB_NAME: 'td`; drop' })).toThrow(EnvError);
  });
});

import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/config/env';

const BASE = {
  PUBLIC_ORIGIN: 'https://tdbakugan.vn',
  DB_HOST: 'mysql',
  DB_USER: 'tdb',
  DB_PASSWORD: 'mat-khau-bi-mat',
  DB_NAME: 'tdbakugan',
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
    expect(loadEnv({ ...BASE, NODE_ENV: 'production' }).TRUST_PROXY_HOPS).toBe(1);
    expect(
      loadEnv({ ...BASE, NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS,
    ).toBe(0);
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

  it('tên CSDL chỉ gồm chữ, số và dấu _', () => {
    expect(() => loadEnv({ ...BASE, DB_NAME: 'td`; drop' })).toThrow(EnvError);
  });
});

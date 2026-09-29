import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { serializeError } from '../../src/lib/logger';

describe('log không lộ dữ liệu nhạy cảm', () => {
  it('lỗi truy vấn: chỉ ghi câu SQL và mã lỗi MySQL, bỏ tham số', () => {
    const cause = Object.assign(new Error("Duplicate entry for key 'users_email_uq'"), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    });
    const error = new DrizzleQueryError(
      'insert into `users` (`email`, `password_hash`) values (?, ?)',
      ['khach@gmail.com', '$argon2id$v=19$bi-mat'],
      cause,
    );
    const serialized = serializeError(error);
    const text = JSON.stringify(serialized);
    expect(serialized.message).toBe('Failed query');
    expect(serialized.query).toContain('insert into `users`');
    expect(serialized.cause?.errno).toBe(1062);
    expect(text).not.toContain('khach@gmail.com');
    expect(text).not.toContain('argon2id');
  });

  it('che token, mật khẩu, cookie, số tài khoản', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    // Cùng cấu hình che như createLogger, ghi vào bộ nhớ để đọc lại.
    const logger = pino(
      {
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.accountNumber',
          ],
          censor: '[đã che]',
        },
      },
      sink,
    );
    logger.info(
      {
        req: { headers: { authorization: 'Bearer abc.def', cookie: 'rt=xyz' } },
        body: { password: 'MatKhau123', accountNumber: '0123456789' },
      },
      'thử',
    );
    const output = lines.join('');
    expect(output).not.toContain('abc.def');
    expect(output).not.toContain('rt=xyz');
    expect(output).not.toContain('MatKhau123');
    expect(output).not.toContain('0123456789');
  });
});

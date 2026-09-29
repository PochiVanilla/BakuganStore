import pino, { type Logger } from 'pino';
import type { Env } from '../config/env';

export type { Logger };

/** Trường không bao giờ được ghi ra log (mật khẩu, token, cookie, số tài khoản…). */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-chat-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.accountNumber',
  '*.apiKey',
];

interface SerializedError {
  type: string;
  message: string;
  stack?: string;
  code?: unknown;
  errno?: unknown;
  query?: string;
  cause?: SerializedError;
}

/**
 * Lỗi truy vấn của Drizzle có kèm tham số (có thể là email, mã băm…) ngay trong message.
 * Chỉ ghi câu SQL (đã tham số hoá) và mã lỗi của MySQL, bỏ phần tham số.
 */
export function serializeError(error: unknown, depth = 0): SerializedError {
  if (!(error instanceof Error)) return { type: typeof error, message: String(error) };
  const record = error as Error & {
    query?: unknown;
    params?: unknown;
    code?: unknown;
    errno?: unknown;
  };
  const isQueryError = typeof record.query === 'string' && 'params' in record;
  const serialized: SerializedError = {
    type: error.name,
    message: isQueryError ? 'Failed query' : error.message,
    stack: error.stack
      ?.split('\n')
      .slice(0, isQueryError ? 1 : 12)
      .join('\n'),
  };
  if (isQueryError) serialized.query = String(record.query).slice(0, 2_000);
  if (record.code !== undefined) serialized.code = record.code;
  if (record.errno !== undefined) serialized.errno = record.errno;
  if (error.cause !== undefined && depth < 3)
    serialized.cause = serializeError(error.cause, depth + 1);
  return serialized;
}

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    base: { service: 'td-bakugan-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: REDACT_PATHS, censor: '[đã che]' },
    serializers: { err: serializeError, error: serializeError },
  });
}

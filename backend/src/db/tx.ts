import type { Db } from './client';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Mã lỗi InnoDB đáng thử lại: 1213 = deadlock, 1205 = chờ khoá quá lâu. */
const RETRYABLE_ERRNO = new Set([1213, 1205]);

/** Lỗi của mysql2 có thể bị Drizzle bọc trong DrizzleQueryError (nằm ở `cause`). */
export function mysqlErrno(error: unknown): number | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const errno = (current as { errno?: unknown }).errno;
    if (typeof errno === 'number') return errno;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export function isRetryableTxError(error: unknown): boolean {
  const errno = mysqlErrno(error);
  return errno !== undefined && RETRYABLE_ERRNO.has(errno);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chạy `work` trong một transaction mức READ COMMITTED (dùng cho mọi nghiệp vụ có khoá dòng).
 * InnoDB báo deadlock / chờ khoá quá lâu thì chạy lại từ đầu, tối đa `retries` lần,
 * nghỉ ngắn và ngẫu nhiên giữa các lần để hai bên không đụng nhau lần nữa.
 * `work` phải làm lại được từ đầu (không gửi email, không gọi cổng thanh toán bên trong).
 */
export async function withTransaction<T>(
  db: Db,
  work: (tx: Tx) => Promise<T>,
  options: { retries?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(work, { isolationLevel: 'read committed' });
    } catch (error) {
      if (attempt >= retries || !isRetryableTxError(error)) throw error;
      await sleep(20 * 2 ** attempt + Math.floor(Math.random() * 30));
    }
  }
}

import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '../db/client';
import { withNamedLock } from '../db/locks';
import { idempotencyKeys, media } from '../db/schema';
import type { Logger } from '../lib/logger';
import type { FeedCatalog } from '../modules/catalog/store';
import { expireCardHolds } from '../modules/orders/mutations';
import { releaseMedia } from '../modules/uploads/media';

/*
 * Việc chạy nền của backend (kế hoạch 8.17). Mỗi việc chạy trong khoá tên của MySQL, nên nếu
 * sau này chạy hai server thì cũng chỉ một cái làm; một lượt chưa xong thì lượt sau bỏ qua.
 * Không việc nào tự hoàn tiền.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface JobDeps {
  database: Database;
  catalog: FeedCatalog;
  logger: Logger;
  uploadDir: string;
}

/** File tải lên mà 24 giờ không feed / con / đơn nào dùng tới thì xoá (admin tải rồi bỏ). */
export async function cleanupUnusedMedia(deps: JobDeps, now = new Date()): Promise<number> {
  const rows = await deps.database.db
    .select({ url: media.url })
    .from(media)
    .where(and(eq(media.inUse, false), lt(media.createdAt, new Date(now.getTime() - DAY_MS))))
    .limit(500);
  if (rows.length === 0) return 0;
  await releaseMedia(
    deps.database.db,
    deps.uploadDir,
    rows.map((row) => row.url),
    deps.logger,
  );
  return rows.length;
}

/** Mã chống gửi trùng chỉ cần giữ 24 giờ. */
export async function cleanupIdempotencyKeys(deps: JobDeps, now = new Date()): Promise<number> {
  const [result] = await deps.database.db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(now.getTime() - DAY_MS)));
  return result.affectedRows;
}

interface Job {
  name: string;
  everyMs: number;
  run: (deps: JobDeps) => Promise<unknown>;
}

export const JOBS: readonly Job[] = [
  // Đơn trả thẻ quá 15 phút chưa trả: huỷ, mở bán lại hàng (trước khi đặt đơn / mở phiên trả cũng chạy).
  {
    name: 'card-holds',
    everyMs: 30_000,
    run: (deps) =>
      expireCardHolds({ db: deps.database.db, catalog: deps.catalog, logger: deps.logger }),
  },
  { name: 'media-cleanup', everyMs: 60 * 60_000, run: cleanupUnusedMedia },
  { name: 'idempotency-cleanup', everyMs: 60 * 60_000, run: cleanupIdempotencyKeys },
];

/** Bật các việc chạy nền; trả về hàm tắt (gọi khi server dừng). */
export function startJobs(deps: JobDeps): () => void {
  const timers = JOBS.map((job) => {
    let running = false;
    const tick = async (): Promise<void> => {
      if (running) return;
      running = true;
      try {
        await withNamedLock(deps.database.pool, `job:${job.name}`, 0, () => job.run(deps));
      } catch (error) {
        deps.logger.error({ err: error, job: job.name }, 'Việc chạy nền bị lỗi');
      } finally {
        running = false;
      }
    };
    // Chạy lần đầu sau vài giây (để server khởi động xong), rồi lặp theo chu kỳ.
    const first = setTimeout(() => void tick(), 5_000);
    const every = setInterval(() => void tick(), job.everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  });
  return () => timers.forEach((stop) => stop());
}

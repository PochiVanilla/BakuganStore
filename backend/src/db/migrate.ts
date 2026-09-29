import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import type { Logger } from '../lib/logger';
import { pingDatabase, type Database } from './client';
import { withNamedLock } from './locks';
import { ensureBaseData } from './seed';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Thư mục drizzle/ nằm cạnh src/ khi chạy dev và cạnh dist/ khi chạy bản build. */
export function findMigrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve('drizzle'),
    path.resolve(here, '../drizzle'),
    path.resolve(here, '../../drizzle'),
  ];
  const found = candidates.find((dir) => existsSync(path.join(dir, 'meta', '_journal.json')));
  if (!found) throw new Error('Không tìm thấy thư mục migration (backend/drizzle).');
  return found;
}

/**
 * Chờ MySQL sẵn sàng. Lần đầu `docker compose up`, MySQL cần vài chục giây để khởi tạo;
 * mất điện rồi bật lại cũng vậy.
 */
export async function waitForDatabase(
  database: Database,
  logger: Logger,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
  const attempts = options.attempts ?? 45;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await pingDatabase(database.pool, 3_000)) return;
    logger.warn({ attempt, attempts }, 'Chưa kết nối được MySQL, thử lại sau 2 giây');
    await sleep(options.delayMs ?? 2_000);
  }
  throw new Error('Không kết nối được MySQL. Kiểm tra DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
}

/**
 * Cập nhật CSDL theo migration mới nhất rồi tạo dữ liệu ban đầu còn thiếu.
 * Bọc trong khoá tên: hai server khởi động cùng lúc thì một cái chờ cái kia làm xong.
 */
export async function prepareDatabase(database: Database, logger: Logger): Promise<void> {
  const migrationsFolder = findMigrationsFolder();
  const outcome = await withNamedLock(database.pool, 'setup', 120, async () => {
    await migrate(database.db, { migrationsFolder });
    return ensureBaseData(database.db);
  });
  if (!outcome.acquired) {
    throw new Error('Không lấy được khoá cập nhật CSDL (có server khác đang cập nhật quá lâu?).');
  }
  logger.info(
    { created: outcome.result.created },
    outcome.result.created.length > 0
      ? 'CSDL đã cập nhật; đã tạo dữ liệu ban đầu còn thiếu'
      : 'CSDL đã cập nhật theo migration mới nhất',
  );
}

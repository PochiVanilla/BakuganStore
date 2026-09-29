import { EnvError, loadEnv } from './config/env';
import { createDatabase } from './db/client';
import { prepareDatabase, waitForDatabase } from './db/migrate';
import { ensureBaseData } from './db/seed';
import { createLogger } from './lib/logger';

/*
 * Lệnh quản trị chạy trên mini PC:
 *   docker compose exec api node dist/cli.js <lệnh>
 * hoặc khi phát triển: npm run cli -- <lệnh>
 */
const HELP = `Cách dùng: node dist/cli.js <lệnh>

  migrate   Cập nhật CSDL theo migration mới nhất và tạo dữ liệu ban đầu còn thiếu
            (server cũng tự làm việc này mỗi lần khởi động)
  seed      Chỉ tạo dữ liệu ban đầu còn thiếu (cài đặt, mã giảm giá, bài blog)
  help      Hiện hướng dẫn này
`;

async function main(): Promise<number> {
  const command = process.argv[2] ?? 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(HELP);
    return 0;
  }
  if (command !== 'migrate' && command !== 'seed') {
    process.stderr.write(`Không có lệnh "${command}".\n\n${HELP}`);
    return 1;
  }

  const env = loadEnv();
  const logger = createLogger({ ...env, LOG_LEVEL: env.LOG_LEVEL });
  const database = createDatabase(env);
  try {
    await waitForDatabase(database, logger, { attempts: 10 });
    if (command === 'migrate') {
      await prepareDatabase(database, logger);
    } else {
      const { created } = await ensureBaseData(database.db);
      process.stdout.write(
        created.length > 0
          ? `Đã tạo: ${created.join(', ')}\n`
          : 'Dữ liệu ban đầu đã đủ, không tạo gì thêm.\n',
      );
    }
    return 0;
  } finally {
    await database.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof EnvError ? error.message : error);
    process.exit(1);
  });

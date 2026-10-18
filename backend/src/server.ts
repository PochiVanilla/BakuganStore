import { createServer } from 'node:http';
import { createApp } from './app';
import { EnvError, loadEnv } from './config/env';
import { createDatabase } from './db/client';
import { prepareDatabase, waitForDatabase } from './db/migrate';
import { startJobs } from './jobs';
import { createLogger } from './lib/logger';
import { FeedCatalog } from './modules/catalog/store';

/** Chờ request đang chạy xong tối đa ngần này rồi mới đóng hẳn khi tắt server. */
const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const database = createDatabase(env);

  if (env.DB_MIGRATE_ON_START) {
    await waitForDatabase(database, logger);
    await prepareDatabase(database, logger);
  }

  if (env.generatedSecrets.length > 0) {
    logger.warn(
      { missing: env.generatedSecrets },
      'Chưa đặt khoá trong .env — đang dùng khoá tạm: khởi động lại là phải đăng nhập lại, ' +
        'số tài khoản ngân hàng đã lưu không đọc lại được',
    );
  }

  // Danh sách feed đệm dùng chung giữa API và việc chạy nền (huỷ đơn quá hạn thì xoá đệm).
  const catalog = new FeedCatalog(database.db);
  const app = createApp({ env, logger, database, catalog });
  const server = createServer(app);
  // Lâu hơn thời gian Caddy giữ kết nối rảnh (2 phút) để không đóng giữa lúc Caddy đang gửi.
  server.keepAliveTimeout = 130_000;
  server.headersTimeout = 131_000;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, env.HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
      env: env.NODE_ENV,
      gemini: Boolean(env.GEMINI_API_KEY),
    },
    'TD Bakugan API đang chạy',
  );
  if (env.cardGateway === 'mock') {
    logger.warn(
      'Thanh toán thẻ đang dùng CỔNG GIẢ LẬP (chỉ nhận thẻ thử) — không dùng khi bán thật',
    );
  }
  const stopJobs = startJobs({ database, catalog, logger, uploadDir: env.uploadDir });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Đang tắt server: chờ request đang chạy xong');
    stopJobs();
    const force = setTimeout(() => {
      logger.warn('Quá thời gian chờ, đóng mọi kết nối còn lại');
      server.closeAllConnections();
    }, SHUTDOWN_GRACE_MS);
    force.unref();
    server.close(() => {
      clearTimeout(force);
      database
        .close()
        .catch((error: unknown) => logger.error({ err: error }, 'Lỗi khi đóng kết nối MySQL'))
        .finally(() => {
          logger.info('Đã tắt server');
          process.exit(0);
        });
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Promise bị từ chối mà không ai bắt');
  });
}

main().catch((error: unknown) => {
  // Lỗi biến môi trường chỉ liệt kê tên biến và lý do, không in giá trị.
  console.error(error instanceof EnvError ? error.message : error);
  process.exit(1);
});

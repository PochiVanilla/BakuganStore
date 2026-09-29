import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Env } from './config/env';
import type { Database } from './db/client';
import type { Logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRateLimit, requireAllowedOrigin } from './middleware/security';
import { chatBotRouter, type ChatBotHandlers } from './modules/bot/routes';
import { healthRouter } from './modules/health/routes';

export interface AppContext {
  env: Env;
  logger: Logger;
  database: Database;
  /** Chỉ test mới thay: hàm bot giả để không gọi Gemini thật */
  chatBot?: ChatBotHandlers;
  /** Số request tối đa mỗi phút cho mỗi IP (mặc định 300) */
  rateLimitPerMinute?: number;
}

/**
 * Lắp middleware và các router. Thứ tự:
 * log + mã request → header an toàn → giới hạn tần suất → chặn origin lạ → router → 404 → lỗi.
 */
export function createApp({
  env,
  logger,
  database,
  chatBot,
  rateLimitPerMinute,
}: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  // Chỉ tin IP do đúng số lớp proxy phía trước chuyển vào (Caddy trên mini PC = 1).
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  // Đọc được mảng dạng attributes[]=pyrus&attributes[]=aquos như axios của web gửi.
  app.set('query parser', 'extended');

  app.use(requestLogger(logger));
  // HSTS do Caddy đặt cho cả web lẫn API.
  app.use(helmet({ hsts: false }));
  app.use('/api', apiRateLimit({ limit: rateLimitPerMinute }));
  app.use('/api', requireAllowedOrigin(env));

  // Bot nhận body thô (tới 512 KB) và tự đọc JSON như trên Vercel → đặt trước bộ đọc JSON chung.
  app.use('/api/chat-bot', chatBotRouter(chatBot));
  app.use('/api', express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter(database));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../lib/logger';

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Gắn mã request (nhận lại mã Caddy / web gửi kèm nếu hợp lệ) và ghi một dòng log mỗi request.
 * Chỉ ghi đường dẫn, không ghi phần sau dấu "?" để tham số nhạy cảm không lọt vào log.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, error) => {
      // 503 là trạng thái đã biết (CSDL chưa sẵn sàng, chưa có khoá Gemini): cảnh báo là đủ.
      if (error || (res.statusCode >= 500 && res.statusCode !== 503)) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Lỗi thật đã được errorHandler ghi kèm chi tiết; ở đây bỏ lỗi giả "failed with status code …".
    customErrorObject: (_req, _res, error, loggable: Record<string, unknown>) =>
      error.message.startsWith('failed with status code')
        ? { ...loggable, err: undefined }
        : loggable,
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    serializers: {
      // `raw` là request của Express: `ip` đã tính theo số lớp proxy tin cậy (IP thật của khách).
      req: (req: { id: unknown; method: string; url: string; raw?: { ip?: string } }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?')[0],
        ip: req.raw?.ip,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}

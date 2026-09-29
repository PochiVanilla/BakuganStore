import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Env } from '../config/env';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isAllowedOrigin(origin: string, req: Request, allowed: readonly string[]): boolean {
  try {
    const url = new URL(origin);
    if (allowed.includes(url.origin)) return true;
    // Cùng máy chủ với web (VD mở web bằng IP trong mạng nhà trước khi có tên miền):
    // Caddy giữ nguyên Host của trình duyệt, và trang lạ không giả được Host.
    return url.host === req.headers.host;
  } catch {
    return false;
  }
}

/**
 * Chặn trang web lạ lợi dụng trình duyệt của khách để gọi API thay đổi dữ liệu (CSRF).
 * Trình duyệt luôn gửi Origin với request khác GET; request không có Origin
 * (cổng thanh toán, lệnh curl) thì cho qua để tầng xác thực quyết định.
 */
export function requireAllowedOrigin(env: Pick<Env, 'allowedOrigins'>): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (
      !UNSAFE_METHODS.has(req.method) ||
      !origin ||
      isAllowedOrigin(origin, req, env.allowedOrigins)
    ) {
      next();
      return;
    }
    res.status(403).json({ message: 'Yêu cầu bị từ chối.' });
  };
}

/** Lớp chắn chung cho mọi API: đủ rộng cho web dùng bình thường, chặn gọi dồn. */
export function apiRateLimit(options: { limit?: number; windowMs?: number } = {}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? 60_000,
    limit: options.limit ?? 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ message: 'Bạn thao tác quá nhanh, thử lại sau ít phút nhé.' });
    },
  });
}

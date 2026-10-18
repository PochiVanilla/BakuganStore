import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import type { Env } from '../config/env';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import { ApiError, forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../modules/auth/tokens';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'admin';
  status: 'active' | 'locked';
  memberLevel: number;
}

export interface AuthContext {
  user: AuthUser;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Người đang gọi (đọc từ access token, tra lại trong CSDL mỗi request) */
    auth?: AuthContext;
  }
}

/** Đường không cần access token (tính từ /api) */
const TOKENLESS_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export const LOCKED_MESSAGE =
  'Tài khoản của bạn đang bị tạm khoá. Vui lòng liên hệ hotline của shop để được hỗ trợ.';

/**
 * Đọc header `Authorization: Bearer …`. Không có token thì đi tiếp như khách vãng lai.
 * Có token mà sai / hết hạn / phiên đã thu hồi thì trả 401 để web tự gia hạn phiên.
 * Tài khoản và phiên được tra lại trong CSDL mỗi lần, nên khoá tài khoản, đổi quyền hay
 * đăng xuất có hiệu lực ngay, không chờ token hết hạn.
 */
export function authenticate(env: Pick<Env, 'jwtSecret'>, db: Db): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header) {
      next();
      return;
    }
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    const claims = match ? await verifyAccessToken(match[1]!, env.jwtSecret) : null;
    if (!claims) {
      // Gia hạn phiên, đăng nhập, đăng xuất… không cần access token: token cũ hỏng thì bỏ qua,
      // nếu không web sẽ không bao giờ gia hạn được phiên.
      if (TOKENLESS_PATHS.has(req.path)) {
        next();
        return;
      }
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        memberLevel: users.memberLevel,
      })
      .from(users)
      .innerJoin(
        sessions,
        and(
          eq(sessions.id, claims.sessionId),
          eq(sessions.userId, users.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, sql`UTC_TIMESTAMP(3)`),
        ),
      )
      .where(eq(users.id, claims.userId))
      .limit(1);
    if (!row) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    req.auth = { user: row, sessionId: claims.sessionId };
    next();
  };
}

/** Phải đăng nhập, tài khoản đang hoạt động (khách hoặc admin). */
export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw unauthorized();
  if (req.auth.user.status !== 'active') throw forbidden(LOCKED_MESSAGE);
  next();
};

/** Chỉ tài khoản khách: admin không đặt hàng, không đặt giá bằng tài khoản quản trị. */
export const requireCustomer: RequestHandler = (req, res, next) => {
  requireUser(req, res, () => {
    if (req.auth!.user.role !== 'customer') {
      throw forbidden('Tài khoản quản trị không dùng để mua hàng hay đặt giá.');
    }
    next();
  });
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  if (req.auth.user.status !== 'active') throw forbidden('Tài khoản của bạn đang bị khoá.');
  if (req.auth.user.role !== 'admin') {
    throw forbidden('Bạn không có quyền truy cập khu vực quản trị.');
  }
  next();
};

/** Lấy người dùng đã xác thực (dùng sau requireUser / requireCustomer / requireAdmin). */
export function currentUser(req: { auth?: AuthContext }): AuthUser {
  if (!req.auth) throw unauthorized();
  return req.auth.user;
}

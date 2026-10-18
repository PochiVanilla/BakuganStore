import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Env } from '../../config/env';
import { readCookie } from '../../lib/cookies';
import { currentUser, requireUser } from '../../middleware/auth';
import * as auth from './service';

export const REFRESH_COOKIE = 'td_rt';
/** Cookie chỉ gửi kèm các đường /api/auth (gia hạn, đăng xuất) */
const COOKIE_PATH = '/api/auth';

function limiter(limit: number, windowMs: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ message });
    },
  });
}

function clientMeta(req: Request): auth.ClientMeta {
  return { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' };
}

/**
 * Refresh token nằm trong cookie httpOnly (JavaScript trên trang không đọc được),
 * SameSite=Lax, chỉ gửi qua HTTPS khi web chạy HTTPS.
 */
function setRefreshCookie(
  res: Response,
  env: Pick<Env, 'secureCookies'>,
  session: auth.IssuedSession,
): void {
  if (!session.refreshToken) return;
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'lax',
    path: COOKIE_PATH,
    // Không chọn "Ghi nhớ" thì là cookie phiên: đóng trình duyệt là mất.
    ...(session.refreshMaxAgeMs ? { maxAge: session.refreshMaxAgeMs } : {}),
  });
}

function clearRefreshCookie(res: Response, env: Pick<Env, 'secureCookies'>): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'lax',
    path: COOKIE_PATH,
  });
}

/** /api/auth — đăng ký, đăng nhập, phiên, hồ sơ, mật khẩu, tài khoản nhận hoàn tiền. */
export function authRouter(deps: auth.AuthDeps & { env: Pick<Env, 'secureCookies'> }): Router {
  const router = Router();
  const wait = 'Bạn thao tác quá nhiều lần, vui lòng thử lại sau ít phút.';

  router.post('/register', limiter(10, 60 * 60 * 1000, wait), async (req, res) => {
    res.status(201).json({ data: await auth.register(deps, req.body) });
  });

  router.post('/login', limiter(10, 60 * 1000, wait), async (req, res) => {
    const session = await auth.login(deps, req.body, clientMeta(req));
    setRefreshCookie(res, deps.env, session);
    res.json({ data: { user: session.user, accessToken: session.accessToken } });
  });

  router.post('/refresh', limiter(60, 60 * 1000, wait), async (req, res) => {
    try {
      const session = await auth.refresh(deps, readCookie(req, REFRESH_COOKIE), clientMeta(req));
      setRefreshCookie(res, deps.env, session);
      res.json({ data: { user: session.user, accessToken: session.accessToken } });
    } catch (error) {
      clearRefreshCookie(res, deps.env);
      throw error;
    }
  });

  router.post('/logout', async (req, res) => {
    await auth.logout(deps, readCookie(req, REFRESH_COOKIE), req.auth?.sessionId);
    clearRefreshCookie(res, deps.env);
    res.json({ data: { ok: true } });
  });

  router.post('/forgot-password', limiter(10, 60 * 60 * 1000, wait), async (req, res) => {
    res.json({ data: await auth.requestPasswordReset(deps, req.body) });
  });

  router.post('/reset-password', limiter(10, 60 * 60 * 1000, wait), async (req, res) => {
    res.json({ data: await auth.resetPassword(deps, req.body) });
  });

  router.get('/me', requireUser, async (req, res) => {
    res.json({ data: await auth.loadSessionUser(deps.db, currentUser(req).id) });
  });

  router.patch('/me', requireUser, async (req, res) => {
    res.json({ data: await auth.updateProfile(deps, currentUser(req).id, req.body) });
  });

  router.post('/change-password', requireUser, async (req, res) => {
    await auth.changePassword(deps, currentUser(req).id, req.auth!.sessionId, req.body);
    res.json({ data: { ok: true } });
  });

  router.put('/me/bank-account', requireUser, async (req, res) => {
    res.json({ data: await auth.saveBankAccount(deps, currentUser(req).id, req.body) });
  });

  router.delete('/me/bank-account', requireUser, async (req, res) => {
    await auth.removeBankAccount(deps, currentUser(req).id);
    res.json({ data: { ok: true } });
  });

  return router;
}

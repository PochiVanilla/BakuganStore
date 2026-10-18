import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Env } from '../../config/env';
import type { Db } from '../../db/client';
import { addresses, bankAccounts, passwordResets, sessions, users } from '../../db/schema';
import { withTransaction, type Tx } from '../../db/tx';
import { encryptSecret, randomToken, sha256Hex } from '../../lib/crypto';
import { ApiError, conflict, parseInput, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password';
import type { Mailer } from '../../mail';
import {
  bankAccountSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
} from '../../shared/authSchemas';
import type { BankAccount, User } from '../../shared/types';
import { LOCKED_MESSAGE } from '../../middleware/auth';
import { toMaskedBankAccount, toSessionUser } from './dto';
import { signAccessToken } from './tokens';

export interface AuthDeps {
  db: Db;
  env: Pick<Env, 'jwtSecret' | 'bankDataKey' | 'PUBLIC_ORIGIN'>;
  mailer: Mailer;
  logger: Logger;
}

export interface ClientMeta {
  ip: string;
  userAgent: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Ghi nhớ đăng nhập": 30 ngày; không thì 1 ngày */
const REMEMBER_MS = 30 * DAY_MS;
const SESSION_MS = DAY_MS;
/** Sai mật khẩu liền ngần này lần thì khoá đăng nhập tạm */
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const RESET_TOKEN_MS = 30 * 60 * 1000;
const RESETS_PER_HOUR = 3;
/** Hai tab cùng gia hạn phiên một lúc: token cũ vẫn được nhận trong khoảng này */
const REFRESH_GRACE_MS = 30 * 1000;

export const INVALID_LOGIN = 'Email hoặc mật khẩu không đúng.';
const EXPIRED_SESSION = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export interface IssuedSession {
  user: User;
  accessToken: string;
  /** Refresh token gốc — chỉ để đặt cookie, không bao giờ trả trong body */
  refreshToken?: string;
  refreshMaxAgeMs?: number;
}

/* ---------------- Đọc hồ sơ ---------------- */

export async function loadSessionUser(db: Db | Tx, userId: string): Promise<User> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new ApiError(401, EXPIRED_SESSION);
  const addressRows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(asc(addresses.createdAt), asc(addresses.id));
  const [bank] = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  return toSessionUser(row, addressRows, bank);
}

/* ---------------- Đăng ký ---------------- */

export async function register(deps: AuthDeps, body: unknown): Promise<{ email: string }> {
  const input = parseInput(registerSchema, body);
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  try {
    await deps.db.insert(users).values({
      id: newId(),
      email,
      passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      tags: ['Khách mới'],
    });
  } catch (error) {
    if (isDuplicate(error)) {
      throw conflict('Email này đã được đăng ký.', { email: 'Email này đã được đăng ký.' });
    }
    throw error;
  }
  return { email };
}

function isDuplicate(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if ((current as { errno?: number }).errno === 1062) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/* ---------------- Phiên đăng nhập ---------------- */

async function openSession(
  deps: AuthDeps,
  tx: Db | Tx,
  userId: string,
  options: { remember: boolean; familyId?: string; meta: ClientMeta },
): Promise<{ sessionId: string; refreshToken: string; maxAgeMs: number }> {
  const sessionId = newId();
  const refreshToken = randomToken();
  const maxAgeMs = options.remember ? REMEMBER_MS : SESSION_MS;
  await tx.insert(sessions).values({
    id: sessionId,
    userId,
    familyId: options.familyId ?? newId(),
    tokenHash: sha256Hex(refreshToken),
    expiresAt: new Date(Date.now() + maxAgeMs),
    remember: options.remember,
    userAgent: options.meta.userAgent.slice(0, 255),
    ip: options.meta.ip.slice(0, 45),
  });
  return { sessionId, refreshToken, maxAgeMs };
}

export async function login(
  deps: AuthDeps,
  body: unknown,
  meta: ClientMeta,
): Promise<IssuedSession> {
  const input = parseInput(loginSchema, body);
  const email = normalizeEmail(input.email);
  const [user] = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw new ApiError(401, INVALID_LOGIN, { password: INVALID_LOGIN });
  }
  if (user.loginLockedUntil && user.loginLockedUntil.getTime() > Date.now()) {
    throw new ApiError(
      429,
      'Bạn nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút hoặc dùng "Quên mật khẩu".',
    );
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failed = user.failedLogins + 1;
    await deps.db
      .update(users)
      .set(
        failed >= MAX_FAILED_LOGINS
          ? { failedLogins: 0, loginLockedUntil: new Date(Date.now() + LOGIN_LOCK_MS) }
          : { failedLogins: failed },
      )
      .where(eq(users.id, user.id));
    throw new ApiError(401, INVALID_LOGIN, { password: INVALID_LOGIN });
  }
  if (user.status !== 'active') throw new ApiError(423, LOCKED_MESSAGE);

  const { sessionId, refreshToken, maxAgeMs } = await withTransaction(deps.db, async (tx) => {
    await tx
      .update(users)
      .set({ failedLogins: 0, loginLockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return openSession(deps, tx, user.id, { remember: input.rememberMe, meta });
  });
  return {
    user: await loadSessionUser(deps.db, user.id),
    accessToken: await signAccessToken({ userId: user.id, sessionId }, deps.env.jwtSecret),
    refreshToken,
    refreshMaxAgeMs: input.rememberMe ? maxAgeMs : undefined,
  };
}

/**
 * Gia hạn phiên bằng refresh token trong cookie. Mỗi lần dùng là đổi token mới (xoay vòng).
 * Token đã bị thay mà vẫn có người dùng lại (quá thời gian chờ của hai tab) = dấu hiệu bị lấy cắp:
 * thu hồi cả chuỗi phiên, bắt đăng nhập lại.
 */
export async function refresh(
  deps: AuthDeps,
  refreshToken: string | undefined,
  meta: ClientMeta,
): Promise<IssuedSession> {
  if (!refreshToken) throw new ApiError(401, EXPIRED_SESSION);
  const tokenHash = sha256Hex(refreshToken);
  const outcome = await withTransaction(deps.db, async (tx) => {
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .for('update');
    if (!session || session.expiresAt.getTime() <= Date.now()) return { kind: 'expired' as const };

    const [user] = await tx.select().from(users).where(eq(users.id, session.userId));
    if (!user || user.status !== 'active') {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.familyId, session.familyId), isNull(sessions.revokedAt)));
      return { kind: 'expired' as const };
    }

    if (session.revokedAt) {
      const withinGrace =
        session.replacedBy && Date.now() - session.revokedAt.getTime() < REFRESH_GRACE_MS;
      if (withinGrace) {
        return { kind: 'grace' as const, userId: user.id, sessionId: session.replacedBy! };
      }
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.familyId, session.familyId), isNull(sessions.revokedAt)));
      return { kind: 'reused' as const };
    }

    const next = await openSession(deps, tx, user.id, {
      remember: session.remember,
      familyId: session.familyId,
      meta,
    });
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), replacedBy: next.sessionId, lastUsedAt: new Date() })
      .where(eq(sessions.id, session.id));
    return { kind: 'rotated' as const, userId: user.id, remember: session.remember, ...next };
  });

  if (outcome.kind === 'expired' || outcome.kind === 'reused') {
    if (outcome.kind === 'reused') {
      deps.logger.warn({ ip: meta.ip }, 'Refresh token cũ bị dùng lại — đã thu hồi cả chuỗi phiên');
    }
    throw new ApiError(401, EXPIRED_SESSION);
  }
  const accessToken = await signAccessToken(
    { userId: outcome.userId, sessionId: outcome.sessionId },
    deps.env.jwtSecret,
  );
  const user = await loadSessionUser(deps.db, outcome.userId);
  if (outcome.kind === 'grace') return { user, accessToken };
  return {
    user,
    accessToken,
    refreshToken: outcome.refreshToken,
    refreshMaxAgeMs: outcome.remember ? outcome.maxAgeMs : undefined,
  };
}

/** Thu hồi phiên hiện tại (theo cookie, hoặc theo access token nếu cookie đã mất). */
export async function logout(
  deps: AuthDeps,
  refreshToken: string | undefined,
  sessionId: string | undefined,
): Promise<void> {
  const now = new Date();
  if (refreshToken) {
    await deps.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.tokenHash, sha256Hex(refreshToken)), isNull(sessions.revokedAt)));
  }
  if (sessionId) {
    await deps.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }
}

/* ---------------- Hồ sơ ---------------- */

export async function updateProfile(deps: AuthDeps, userId: string, body: unknown): Promise<User> {
  const input = parseInput(profileSchema, body);
  try {
    await deps.db
      .update(users)
      .set({
        fullName: input.fullName.trim(),
        email: normalizeEmail(input.email),
        phone: input.phone.trim(),
      })
      .where(eq(users.id, userId));
  } catch (error) {
    if (isDuplicate(error)) {
      const message = 'Email này đã được tài khoản khác sử dụng.';
      throw conflict(message, { email: message });
    }
    throw error;
  }
  return loadSessionUser(deps.db, userId);
}

/** Đổi mật khẩu: đúng mật khẩu cũ mới đổi; mọi phiên khác bị thu hồi. */
export async function changePassword(
  deps: AuthDeps,
  userId: string,
  sessionId: string,
  body: unknown,
): Promise<void> {
  const input = parseInput(changePasswordSchema, body);
  const [user] = await deps.db.select().from(users).where(eq(users.id, userId));
  // 422 chứ không phải 401: 401 làm web tưởng phiên hết hạn và đăng xuất người dùng.
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    const message = 'Mật khẩu hiện tại không đúng.';
    throw unprocessable(message, { currentPassword: message });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await withTransaction(deps.db, async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sessions.userId, userId), ne(sessions.id, sessionId), isNull(sessions.revokedAt)),
      );
  });
}

/* ---------------- Quên / đặt lại mật khẩu ---------------- */

/**
 * Luôn trả cùng một câu, không lộ email nào có tài khoản. Có tài khoản thì gửi link
 * đặt lại mật khẩu (sống 30 phút); mỗi email tối đa 3 thư mỗi giờ.
 */
export async function requestPasswordReset(
  deps: AuthDeps,
  body: unknown,
): Promise<{ email: string }> {
  const input = parseInput(forgotPasswordSchema, body);
  const email = normalizeEmail(input.email);
  const [user] = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || user.status !== 'active') return { email };

  const [recent] = await deps.db
    .select({ count: sql<number>`count(*)` })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.userId, user.id),
        gt(passwordResets.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );
  if (Number(recent?.count ?? 0) >= RESETS_PER_HOUR) return { email };

  const token = randomToken();
  await withTransaction(deps.db, async (tx) => {
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
    await tx.insert(passwordResets).values({
      id: newId(),
      userId: user.id,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_MS),
    });
  });

  const link = `${new URL(deps.env.PUBLIC_ORIGIN).origin}/dat-lai-mat-khau?token=${token}`;
  try {
    await deps.mailer.send({
      to: user.email,
      subject: 'TD Bakugan — Đặt lại mật khẩu',
      text:
        `Chào ${user.fullName},\n\n` +
        `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu tài khoản TD Bakugan.\n` +
        `Mở link sau trong 30 phút để đặt mật khẩu mới:\n${link}\n\n` +
        `Nếu không phải bạn yêu cầu, cứ bỏ qua thư này — mật khẩu cũ vẫn dùng được.\n\nTD Bakugan`,
    });
  } catch (error) {
    deps.logger.error({ err: error }, 'Không gửi được email đặt lại mật khẩu');
  }
  return { email };
}

const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp.',
    path: ['confirmPassword'],
  });

/** Mã đúng, chưa dùng, còn hạn thì đặt mật khẩu mới và thu hồi mọi phiên đăng nhập cũ. */
export async function resetPassword(deps: AuthDeps, body: unknown): Promise<{ email: string }> {
  const input = parseInput(resetPasswordSchema, body);
  const passwordHash = await hashPassword(input.password);
  const email = await withTransaction(deps.db, async (tx) => {
    const [reset] = await tx
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, sha256Hex(input.token)))
      .for('update');
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return null;
    const [user] = await tx.select().from(users).where(eq(users.id, reset.userId));
    if (!user || user.status !== 'active') return null;
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, reset.id));
    await tx
      .update(users)
      .set({ passwordHash, failedLogins: 0, loginLockedUntil: null })
      .where(eq(users.id, user.id));
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    return user.email;
  });
  if (!email) {
    throw unprocessable(
      'Link đặt lại mật khẩu không đúng hoặc đã hết hạn. Bạn yêu cầu link mới nhé.',
      {
        token: 'Link không còn dùng được.',
      },
    );
  }
  return { email };
}

/* ---------------- Tài khoản nhận hoàn tiền ---------------- */

/** Số tài khoản mã hoá AES-256-GCM; trả về chỉ còn 4 số cuối. Không bao giờ ghi số vào log. */
export async function saveBankAccount(
  deps: AuthDeps,
  userId: string,
  body: unknown,
): Promise<BankAccount> {
  const input = parseInput(bankAccountSchema, body);
  const values = {
    bankName: input.bankName,
    accountHolder: input.accountHolder,
    accountNumberEnc: encryptSecret(input.accountNumber, deps.env.bankDataKey),
    accountLast4: input.accountNumber.slice(-4),
    keyVersion: 1,
  };
  await deps.db
    .insert(bankAccounts)
    .values({ userId, ...values })
    .onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
  const [row] = await deps.db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  return toMaskedBankAccount(row!);
}

export async function removeBankAccount(deps: AuthDeps, userId: string): Promise<void> {
  await deps.db.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
}

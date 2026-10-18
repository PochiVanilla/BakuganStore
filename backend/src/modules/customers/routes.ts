import { and, eq, isNull, ne } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { membershipRequests, sessions, users } from '../../db/schema';
import { duplicateKeyName, withTransaction } from '../../db/tx';
import { writeAudit } from '../../lib/audit';
import { conflict, notFound, parseInput, unprocessable } from '../../lib/errors';
import { currentUser, requireAdmin } from '../../middleware/auth';
import { emailSchema, fullNameSchema, phoneSchema } from '../../shared/authSchemas';
import { requestPasswordReset, type AuthDeps } from '../auth/service';
import { toMembershipRequest } from '../membership/routes';
import { customerQuerySchema, getCustomerDetail, listCustomers } from './service';

/*
 * /api/admin/customers và /api/admin/membership-requests — quản lý khách (như
 * src/services/api/admin/customers.ts). Admin không bao giờ xem được số tài khoản ngân hàng
 * hay tự đặt mật khẩu hộ khách (chỉ gửi email đặt lại). Mọi thao tác ghi nhật ký admin.
 */

const NOT_FOUND = 'Không tìm thấy khách hàng này.';

const updateSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: z.union([z.literal(''), phoneSchema]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  adminNote: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự.').default(''),
});

const statusSchema = z.object({
  status: z.enum(['active', 'locked']),
  reason: z.string().max(255).optional(),
});

const roleSchema = z.object({ role: z.enum(['customer', 'admin']) });
const levelSchema = z.object({
  level: z.union([z.literal(1), z.literal(2)]),
  note: z.string().max(500).default(''),
});
const resolveSchema = z.object({ note: z.string().max(500).default('') });

export function adminCustomersRouter(deps: AuthDeps): Router {
  const { db } = deps;
  const router = Router();
  router.use(requireAdmin);

  router.get('/', async (req, res) => {
    res.json({ data: await listCustomers(db, parseInput(customerQuerySchema, req.query)) });
  });

  router.get('/:id', async (req, res) => {
    const customer = await getCustomerDetail(db, req.params.id);
    if (!customer) throw notFound(NOT_FOUND);
    res.json({ data: customer });
  });

  router.patch('/:id', async (req, res) => {
    const input = parseInput(updateSchema, req.body);
    const email = input.email.trim().toLowerCase();
    try {
      await withTransaction(db, async (tx) => {
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, req.params.id))
          .for('update');
        if (!user) throw notFound(NOT_FOUND);
        const [taken] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email), ne(users.id, req.params.id)))
          .limit(1);
        if (taken) {
          throw conflict('Email này đã thuộc về tài khoản khác.', {
            email: 'Email này đã thuộc về tài khoản khác.',
          });
        }
        await tx
          .update(users)
          .set({
            fullName: input.fullName.trim(),
            email,
            phone: input.phone.trim(),
            tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 8),
            adminNote: input.adminNote || null,
          })
          .where(eq(users.id, req.params.id));
        await writeAudit(tx, req, {
          action: 'customer.update',
          targetType: 'user',
          targetId: req.params.id,
        });
      });
    } catch (error) {
      if (duplicateKeyName(error) === 'users_email_uq') {
        throw conflict('Email này đã thuộc về tài khoản khác.', {
          email: 'Email này đã thuộc về tài khoản khác.',
        });
      }
      throw error;
    }
    res.json({ data: { ok: true } });
  });

  router.patch('/:id/status', async (req, res) => {
    const { status, reason } = parseInput(statusSchema, req.body);
    if (currentUser(req).id === req.params.id) {
      throw conflict('Bạn không thể tự khoá tài khoản của chính mình.');
    }
    if (status === 'locked' && !reason?.trim()) {
      throw unprocessable('Vui lòng ghi lý do khoá để lưu vết.', {
        reason: 'Vui lòng ghi lý do khoá để lưu vết.',
      });
    }
    await withTransaction(db, async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, req.params.id))
        .for('update');
      if (!user) throw notFound(NOT_FOUND);
      await tx
        .update(users)
        .set({ status, lockedReason: status === 'locked' ? reason!.trim() : null })
        .where(eq(users.id, req.params.id));
      // Khoá thì đăng xuất mọi nơi ngay (không chờ token hết hạn).
      if (status === 'locked') {
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(sessions.userId, req.params.id), isNull(sessions.revokedAt)));
      }
      await writeAudit(tx, req, {
        action: status === 'locked' ? 'customer.lock' : 'customer.unlock',
        targetType: 'user',
        targetId: req.params.id,
        detail: status === 'locked' ? { reason: reason!.trim() } : undefined,
      });
    });
    res.json({ data: { ok: true } });
  });

  router.patch('/:id/role', async (req, res) => {
    const { role } = parseInput(roleSchema, req.body);
    if (currentUser(req).id === req.params.id) {
      throw conflict('Bạn không thể tự đổi quyền của chính mình.');
    }
    await withTransaction(db, async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, req.params.id))
        .for('update');
      if (!user) throw notFound('Không tìm thấy tài khoản này.');
      await tx.update(users).set({ role }).where(eq(users.id, req.params.id));
      await writeAudit(tx, req, {
        action: 'customer.role',
        targetType: 'user',
        targetId: req.params.id,
        detail: { role },
      });
    });
    res.json({ data: { ok: true } });
  });

  // Admin đặt hạng trực tiếp (duyệt lên Lv2 hoặc hạ về Lv1).
  router.patch('/:id/level', async (req, res) => {
    const { level, note } = parseInput(levelSchema, req.body);
    const admin = currentUser(req);
    await withTransaction(db, async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, req.params.id)).for('update');
      if (!user || user.role !== 'customer') {
        throw notFound('Chỉ đặt hạng cho tài khoản khách hàng.');
      }
      const at = new Date();
      await tx
        .update(users)
        .set({
          memberLevel: level,
          levelSource: level >= 2 ? 'admin' : null,
          levelUpAt: level >= 2 ? at : null,
        })
        .where(eq(users.id, user.id));
      // Chỉ đóng yêu cầu xét duyệt. Yêu cầu nạp tiền vẫn chờ admin đối soát riêng
      // để ghi nhận đúng số tiền khách đã chuyển.
      await tx
        .update(membershipRequests)
        .set({
          status: level >= 2 ? 'approved' : 'rejected',
          resolvedAt: at,
          resolvedBy: admin.id,
          adminNote: note.trim() || null,
        })
        .where(
          and(
            eq(membershipRequests.userId, user.id),
            eq(membershipRequests.status, 'pending'),
            eq(membershipRequests.kind, 'review'),
          ),
        );
      await writeAudit(tx, req, {
        action: 'customer.level',
        targetType: 'user',
        targetId: user.id,
        detail: { level },
      });
    });
    res.json({ data: { ok: true } });
  });

  // Gửi email đặt lại mật khẩu — admin không bao giờ tự đặt mật khẩu hộ khách.
  router.post('/:id/password-reset', async (req, res) => {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, req.params.id))
      .limit(1);
    if (!user) throw notFound(NOT_FOUND);
    await requestPasswordReset(deps, { email: user.email });
    await writeAudit(db, req, {
      action: 'customer.password-reset',
      targetType: 'user',
      targetId: req.params.id,
    });
    res.json({ data: { email: user.email } });
  });

  return router;
}

/** /api/admin/membership-requests/:id/approve|reject — xử lý yêu cầu lên Lv2. */
export function adminMembershipRouter(db: Db): Router {
  const router = Router();
  router.use(requireAdmin);

  router.post('/:id/:decision', async (req, res) => {
    const decision = req.params.decision;
    if (decision !== 'approve' && decision !== 'reject')
      throw notFound('Không tìm thấy đường dẫn này.');
    const approve = decision === 'approve';
    const { note } = parseInput(resolveSchema, req.body ?? {});
    if (!approve && !note.trim()) {
      throw unprocessable('Ghi lý do từ chối để khách biết cần làm gì tiếp.', {
        note: 'Ghi lý do từ chối.',
      });
    }
    const admin = currentUser(req);
    const resolved = await withTransaction(db, async (tx) => {
      const [request] = await tx
        .select()
        .from(membershipRequests)
        .where(eq(membershipRequests.id, req.params.id))
        .for('update');
      if (!request) throw notFound('Không tìm thấy yêu cầu này.');
      if (request.status !== 'pending') throw conflict('Yêu cầu này đã được xử lý.');
      const at = new Date();
      await tx
        .update(membershipRequests)
        .set({
          status: approve ? 'approved' : 'rejected',
          resolvedAt: at,
          resolvedBy: admin.id,
          adminNote: note.trim() || null,
        })
        .where(eq(membershipRequests.id, request.id));
      if (approve) {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, request.userId))
          .for('update');
        if (user) {
          await tx
            .update(users)
            .set({
              // Duyệt yêu cầu nạp tiền: ghi nhận số tiền khách đã chuyển.
              depositBalance:
                user.depositBalance + (request.kind === 'deposit' ? (request.amount ?? 0) : 0),
              ...(user.memberLevel < 2
                ? {
                    memberLevel: 2,
                    levelSource:
                      request.kind === 'deposit' ? ('deposit' as const) : ('admin' as const),
                    levelUpAt: at,
                  }
                : {}),
            })
            .where(eq(users.id, user.id));
        }
      }
      await writeAudit(tx, req, {
        action: approve ? 'membership.approve' : 'membership.reject',
        targetType: 'membership-request',
        targetId: request.id,
        detail: { userId: request.userId, kind: request.kind },
      });
      const [row] = await tx
        .select()
        .from(membershipRequests)
        .where(eq(membershipRequests.id, request.id));
      return row!;
    });
    res.json({ data: toMembershipRequest(resolved, admin.fullName) });
  });

  return router;
}

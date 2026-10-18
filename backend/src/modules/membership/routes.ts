import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { membershipRequests, users } from '../../db/schema';
import { duplicateKeyName, withTransaction, type Tx } from '../../db/tx';
import { conflict, parseInput, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { currentUser, requireUser } from '../../middleware/auth';
import { PURCHASES_FOR_LV2 } from '../../shared/orders';
import type { MemberLevel, MembershipInfo, MembershipRequest } from '../../shared/types';
import { readShopSettings, shopBankOf } from '../settings/shop';
import { applyPurchaseUpgrade, purchasedItemCount } from './rules';

/*
 * /api/me/membership — hạng thành viên của khách đang đăng nhập (như
 * src/services/api/membershipService.ts). Lv2 mới được đặt giá ở sàn đấu giá.
 */

type RequestRow = typeof membershipRequests.$inferSelect;

export function toMembershipRequest(
  row: RequestRow,
  resolvedByName?: string | null,
): MembershipRequest {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    amount: row.amount ?? undefined,
    transferNote: row.transferNote ?? undefined,
    message: row.message ?? undefined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
    resolvedBy: row.resolvedAt ? (resolvedByName ?? 'Hệ thống') : undefined,
    adminNote: row.adminNote ?? undefined,
  };
}

/** Nội dung chuyển khoản khách ghi khi nạp tiền, để admin dò trong sao kê. */
export function transferNoteFor(user: { id: string; phone: string }): string {
  return `TDLV2 ${user.phone.trim() || user.id.toUpperCase()}`;
}

async function membershipInfo(executor: Db | Tx, userId: string): Promise<MembershipInfo> {
  const [user] = await executor.select().from(users).where(eq(users.id, userId)).limit(1);
  const shop = await readShopSettings(executor);
  const [pending] = await executor
    .select()
    .from(membershipRequests)
    .where(and(eq(membershipRequests.userId, userId), eq(membershipRequests.status, 'pending')))
    .orderBy(desc(membershipRequests.createdAt))
    .limit(1);
  return {
    level: (user!.memberLevel >= 2 ? 2 : 1) as MemberLevel,
    source: user!.levelSource ?? undefined,
    levelUpAt: user!.levelUpAt?.toISOString(),
    purchasedCount: await purchasedItemCount(executor, userId),
    purchaseGoal: PURCHASES_FOR_LV2,
    depositAmount: shop.memberDepositAmount,
    depositBalance: user!.depositBalance,
    pendingRequest: pending ? toMembershipRequest(pending) : undefined,
    transferNote: transferNoteFor(user!),
    bank: shopBankOf(shop),
  };
}

const depositSchema = z.object({ message: z.string().max(1_000).default('') });
const reviewSchema = z.object({ message: z.string().max(2_000) });

export function membershipRouter(db: Db): Router {
  const router = Router();
  router.use(requireUser);

  /** Khách được gửi yêu cầu lên hạng không (đúng câu của web). */
  async function assertCanRequest(tx: Tx, userId: string): Promise<void> {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.role !== 'customer') {
      throw conflict('Tài khoản quản trị không cần lên hạng.');
    }
    if (user.memberLevel >= 2) throw conflict('Bạn đã là thành viên Lv2 rồi.');
  }

  async function createRequest(
    userId: string,
    values: Omit<typeof membershipRequests.$inferInsert, 'id' | 'userId'>,
  ): Promise<void> {
    try {
      await withTransaction(db, async (tx) => {
        await assertCanRequest(tx, userId);
        await tx.insert(membershipRequests).values({ id: newId(), userId, ...values });
      });
    } catch (error) {
      // Mỗi khách tối đa một yêu cầu đang chờ (cột sinh + UNIQUE).
      if (duplicateKeyName(error) === 'membership_requests_one_pending_uq') {
        throw conflict('Bạn đã có một yêu cầu đang chờ shop xử lý.');
      }
      throw error;
    }
  }

  router.get('/', async (req, res) => {
    const userId = currentUser(req).id;
    // Phòng khi khách đã đủ điều kiện mà chưa được nâng (VD đơn hoàn tất trước khi có luật này).
    await withTransaction(db, (tx) => applyPurchaseUpgrade(tx, userId, new Date()));
    res.json({ data: await membershipInfo(db, userId) });
  });

  // Khách báo đã chuyển khoản số tiền nạp — admin đối soát rồi xác nhận lên Lv2.
  router.post('/deposit', async (req, res) => {
    const user = currentUser(req);
    const { message } = parseInput(depositSchema, req.body ?? {});
    const shop = await readShopSettings(db);
    const [row] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, user.id));
    await createRequest(user.id, {
      kind: 'deposit',
      amount: shop.memberDepositAmount || null,
      transferNote: transferNoteFor({ id: user.id, phone: row?.phone ?? '' }),
      message: message.trim().slice(0, 300) || null,
    });
    res.status(201).json({ data: await membershipInfo(db, user.id) });
  });

  // Khách nhờ admin xét duyệt lên Lv2 (VD đã mua nhiều tại shop, khách quen).
  router.post('/review', async (req, res) => {
    const user = currentUser(req);
    const text = parseInput(reviewSchema, req.body).message.trim();
    if (text.length < 10) {
      throw unprocessable('Bạn viết thêm vài dòng để shop hiểu vì sao muốn lên Lv2 nhé.', {
        message: 'Viết ít nhất 10 ký tự.',
      });
    }
    await createRequest(user.id, { kind: 'review', message: text.slice(0, 500) });
    res.status(201).json({ data: await membershipInfo(db, user.id) });
  });

  // Khách rút lại yêu cầu đang chờ.
  router.delete('/request', async (req, res) => {
    const userId = currentUser(req).id;
    await db
      .delete(membershipRequests)
      .where(and(eq(membershipRequests.userId, userId), eq(membershipRequests.status, 'pending')));
    res.json({ data: await membershipInfo(db, userId) });
  });

  return router;
}

import { and, count, eq } from 'drizzle-orm';
import { membershipRequests, orderItems, orders, users } from '../../db/schema';
import type { Db } from '../../db/client';
import type { Tx } from '../../db/tx';
import { PURCHASES_FOR_LV2 } from '../../shared/orders';

/*
 * Luật hạng thành viên (như src/services/api/membershipRules.ts của web).
 * Lên Lv2 (được đấu giá) khi: nhận đủ 3 Bakugan (đơn hoàn tất) — tự động; nạp tiền; admin duyệt.
 */

/** Số Bakugan khách đã nhận (chỉ tính đơn hoàn tất). */
export async function purchasedItemCount(executor: Db | Tx, userId: string): Promise<number> {
  const [row] = await executor
    .select({ total: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.userId, userId), eq(orders.status, 'completed')));
  return Number(row?.total ?? 0);
}

/** Đủ 3 con thì tự lên Lv2 và đóng yêu cầu lên hạng đang chờ. Trả về true nếu vừa lên hạng. */
export async function applyPurchaseUpgrade(tx: Tx, userId: string, at: Date): Promise<boolean> {
  const [user] = await tx
    .select({ role: users.role, memberLevel: users.memberLevel })
    .from(users)
    .where(eq(users.id, userId))
    .for('update');
  if (!user || user.role !== 'customer' || user.memberLevel >= 2) return false;
  if ((await purchasedItemCount(tx, userId)) < PURCHASES_FOR_LV2) return false;
  await tx
    .update(users)
    .set({ memberLevel: 2, levelSource: 'purchases', levelUpAt: at })
    .where(eq(users.id, userId));
  await tx
    .update(membershipRequests)
    .set({
      status: 'approved',
      resolvedAt: at,
      adminNote: `Tự lên Lv2 vì đã mua đủ ${PURCHASES_FOR_LV2} Bakugan.`,
    })
    .where(and(eq(membershipRequests.userId, userId), eq(membershipRequests.status, 'pending')));
  return true;
}

import { and, asc, count, desc, eq, inArray, lte, max, or, sql, sum, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import {
  addresses,
  auctions,
  bankAccounts,
  bids,
  membershipRequests,
  orderItems,
  orders,
  users,
} from '../../db/schema';
import { likePattern } from '../catalog/itemList';
import { normalizeSearch } from '../../shared/catalog';
import type {
  AdminCustomer,
  AdminCustomerDetail,
  AdminCustomerStats,
  MemberLevel,
} from '../../shared/types';
import { toAddress } from '../auth/dto';
import { toMembershipRequest } from '../membership/routes';
import { loadOrders } from '../orders/store';

/*
 * Hồ sơ khách cho trang quản trị. Dựng bằng cách *chọn từng trường cho phép* (như
 * toAdminCustomer của web): số tài khoản ngân hàng không bao giờ có mặt, chỉ tên ngân hàng
 * và chủ tài khoản. Số liệu (đơn, tiền đã chi, đấu giá) tính bằng SQL gom nhóm.
 */

type UserRow = typeof users.$inferSelect;

export const customerQuerySchema = z.object({
  keyword: z.string().max(100).default(''),
  status: z.enum(['all', 'active', 'locked']).default('all'),
  role: z.enum(['all', 'customer', 'admin']).default('all'),
  level: z.enum(['all', '1', '2', 'requests']).default('all'),
  sort: z.enum(['recent', 'spent', 'orders', 'name']).default('recent'),
});

const EMPTY_STATS: AdminCustomerStats = {
  orderCount: 0,
  completedCount: 0,
  cancelledCount: 0,
  totalSpent: 0,
  auctionBidCount: 0,
  auctionWinCount: 0,
  purchasedItemCount: 0,
};

/** Số liệu của nhiều khách cùng lúc (mỗi loại một câu SQL gom nhóm). */
async function statsOf(db: Db, ids: readonly string[]): Promise<Map<string, AdminCustomerStats>> {
  const stats = new Map<string, AdminCustomerStats>(ids.map((id) => [id, { ...EMPTY_STATS }]));
  if (ids.length === 0) return stats;
  const list = [...ids];
  const [orderRows, itemRows, bidRows, winRows] = await Promise.all([
    db
      .select({
        userId: orders.userId,
        orderCount: count(),
        completed: sum(sql`${orders.status} = 'completed'`),
        cancelled: sum(sql`${orders.status} = 'cancelled'`),
        spent: sum(
          sql`CASE WHEN ${orders.status} IN ('cancelled', 'returned') THEN 0 ELSE ${orders.total} END`,
        ),
        lastOrderAt: max(orders.createdAt),
      })
      .from(orders)
      .where(inArray(orders.userId, list))
      .groupBy(orders.userId),
    db
      .select({ userId: orders.userId, total: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(inArray(orders.userId, list), eq(orders.status, 'completed')))
      .groupBy(orders.userId),
    db
      .select({ userId: bids.bidderId, total: count() })
      .from(bids)
      .where(inArray(bids.bidderId, list))
      .groupBy(bids.bidderId),
    // Thắng = đang giữ giá cao nhất của phiên đã kết thúc.
    db
      .select({ userId: auctions.leaderId, total: count() })
      .from(auctions)
      .where(
        and(
          inArray(auctions.leaderId, list),
          lte(auctions.endAt, new Date()),
          sql`${auctions.bidCount} > 0`,
        ),
      )
      .groupBy(auctions.leaderId),
  ]);
  for (const row of orderRows) {
    const entry = stats.get(row.userId!)!;
    entry.orderCount = Number(row.orderCount);
    entry.completedCount = Number(row.completed ?? 0);
    entry.cancelledCount = Number(row.cancelled ?? 0);
    entry.totalSpent = Number(row.spent ?? 0);
    entry.lastOrderAt = row.lastOrderAt ? new Date(row.lastOrderAt).toISOString() : undefined;
  }
  for (const row of itemRows) stats.get(row.userId!)!.purchasedItemCount = Number(row.total);
  for (const row of bidRows) stats.get(row.userId)!.auctionBidCount = Number(row.total);
  for (const row of winRows) stats.get(row.userId!)!.auctionWinCount = Number(row.total);
  return stats;
}

/** Ghép hồ sơ admin cho một loạt tài khoản (địa chỉ, liên kết ngân hàng, yêu cầu Lv2, số liệu). */
async function toAdminCustomers(db: Db, rows: readonly UserRow[]): Promise<AdminCustomer[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [addressRows, bankRows, pendingRows, stats] = await Promise.all([
    db
      .select()
      .from(addresses)
      .where(inArray(addresses.userId, ids))
      .orderBy(asc(addresses.createdAt)),
    // Chỉ lấy tên ngân hàng và chủ tài khoản — không bao giờ đọc cột số tài khoản.
    db
      .select({
        userId: bankAccounts.userId,
        bankName: bankAccounts.bankName,
        accountHolder: bankAccounts.accountHolder,
      })
      .from(bankAccounts)
      .where(inArray(bankAccounts.userId, ids)),
    db
      .select()
      .from(membershipRequests)
      .where(
        and(inArray(membershipRequests.userId, ids), eq(membershipRequests.status, 'pending')),
      ),
    statsOf(db, ids),
  ]);
  const banks = new Map(bankRows.map((row) => [row.userId, row]));
  const pending = new Map(pendingRows.map((row) => [row.userId, row]));
  return rows.map((row) => {
    const bank = banks.get(row.id);
    const request = pending.get(row.id);
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatarUrl ?? undefined,
      role: row.role,
      status: row.status,
      lockedReason: row.lockedReason ?? undefined,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString(),
      birthday: row.birthday ?? undefined,
      gender: row.gender ?? undefined,
      addresses: addressRows.filter((address) => address.userId === row.id).map(toAddress),
      tags: row.tags,
      adminNote: row.adminNote ?? '',
      bankLink: bank ? { bankName: bank.bankName, accountHolder: bank.accountHolder } : null,
      memberLevel: (row.memberLevel >= 2 ? 2 : 1) as MemberLevel,
      levelSource: row.levelSource ?? undefined,
      levelUpAt: row.levelUpAt?.toISOString(),
      depositBalance: row.depositBalance,
      pendingLevelRequest: request ? toMembershipRequest(request) : undefined,
      stats: stats.get(row.id)!,
    } satisfies AdminCustomer;
  });
}

export async function listCustomers(
  db: Db,
  query: z.infer<typeof customerQuerySchema>,
): Promise<AdminCustomer[]> {
  const conditions: Array<SQL | undefined> = [];
  if (query.status !== 'all') conditions.push(eq(users.status, query.status));
  if (query.role !== 'all') conditions.push(eq(users.role, query.role));
  if (query.level === '1' || query.level === '2') {
    conditions.push(
      and(
        eq(users.role, 'customer'),
        query.level === '2' ? sql`${users.memberLevel} >= 2` : sql`${users.memberLevel} < 2`,
      ),
    );
  }
  if (query.level === 'requests') {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${membershipRequests} WHERE ${membershipRequests.userId} = ${users.id} AND ${membershipRequests.status} = 'pending')`,
    );
  }
  const needle = normalizeSearch(query.keyword);
  if (needle) {
    const pattern = likePattern(needle);
    conditions.push(
      or(
        sql`${users.fullName} LIKE ${pattern}`,
        sql`${users.email} LIKE ${pattern}`,
        sql`${users.phone} LIKE ${pattern}`,
        sql`CAST(${users.tags} AS CHAR) LIKE ${pattern}`,
      ),
    );
  }
  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.lastLoginAt), desc(users.createdAt))
    .limit(1_000);
  const customers = await toAdminCustomers(db, rows);
  const sorters: Record<typeof query.sort, (a: AdminCustomer, b: AdminCustomer) => number> = {
    recent: (a, b) => (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? ''),
    spent: (a, b) => b.stats.totalSpent - a.stats.totalSpent,
    orders: (a, b) => b.stats.orderCount - a.stats.orderCount,
    name: (a, b) => a.fullName.localeCompare(b.fullName, 'vi'),
  };
  return customers.sort(sorters[query.sort]);
}

export async function getCustomerDetail(
  db: Db,
  customerId: string,
): Promise<AdminCustomerDetail | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
  if (!row) return undefined;
  const [customer] = await toAdminCustomers(db, [row]);
  const [requestRows, orderViews, bidRows] = await Promise.all([
    db
      .select({ request: membershipRequests, resolvedByName: users.fullName })
      .from(membershipRequests)
      .leftJoin(users, eq(users.id, membershipRequests.resolvedBy))
      .where(eq(membershipRequests.userId, customerId))
      .orderBy(desc(membershipRequests.createdAt)),
    loadOrders(db, 'admin', { where: eq(orders.userId, customerId) }),
    db
      .select({
        auctionId: auctions.id,
        title: auctions.title,
        startAt: auctions.startAt,
        endAt: auctions.endAt,
        leaderId: auctions.leaderId,
        myHighestBid: max(bids.amount),
        bidCount: count(),
      })
      .from(bids)
      .innerJoin(auctions, eq(auctions.id, bids.auctionId))
      .where(eq(bids.bidderId, customerId))
      .groupBy(auctions.id),
  ]);
  const now = Date.now();
  return {
    ...customer!,
    levelRequests: requestRows.map((entry) =>
      toMembershipRequest(entry.request, entry.resolvedByName),
    ),
    orders: orderViews,
    auctions: bidRows.map((entry) => ({
      auctionId: entry.auctionId,
      title: entry.title,
      myHighestBid: Number(entry.myHighestBid ?? 0),
      bidCount: Number(entry.bidCount),
      isWinning: entry.leaderId === customerId,
      status:
        entry.startAt.getTime() > now ? 'upcoming' : entry.endAt.getTime() > now ? 'live' : 'ended',
    })),
  };
}

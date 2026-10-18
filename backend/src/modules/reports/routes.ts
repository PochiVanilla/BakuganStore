import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
  sum,
} from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client';
import {
  auctionFulfillments,
  auctions,
  conversations,
  items,
  membershipRequests,
  orderIssues,
  orders,
  users,
} from '../../db/schema';
import { parseInput } from '../../lib/errors';
import { requireAdmin } from '../../middleware/auth';
import { ACTIVE_ORDER_STATUSES, VOID_ORDER_STATUSES } from '../../shared/orders';
import {
  CANCEL_REASONS,
  FEED_LIMIT,
  ISSUE_TYPES,
  ORDER_STATUSES,
  type CancelReason,
  type DashboardStats,
  type IssueType,
  type OrderStatus,
} from '../../shared/types';
import { listIssues } from '../adminOrders/service';
import type { FeedCatalog } from '../catalog/store';
import { loadOrders } from '../orders/store';

/*
 * Số liệu cho trang Tổng quan, báo cáo huỷ đơn & sự cố, và số đếm trên menu admin (kế hoạch 8.14).
 * Tính bằng SQL gom nhóm, không kéo cả bảng về. Ngày tính theo giờ Việt Nam.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const rangeSchema = z.object({ days: z.coerce.number().int().min(1).max(3_650).default(30) });

/** "2026-10-18" theo giờ Việt Nam */
function vnDateKey(at: number | Date): string {
  return new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const notVoid = notInArray(orders.status, [...VOID_ORDER_STATUSES]);

/** Các con số chung của trang Tổng quan và menu admin. */
async function workloadCounts(db: Db, catalog: FeedCatalog) {
  const now = new Date();
  const [[active], [levels], [issues], [chats], [awaiting], posts, [leftovers]] = await Promise.all(
    [
      db
        .select({ total: count() })
        .from(orders)
        .where(inArray(orders.status, [...ACTIVE_ORDER_STATUSES])),
      db
        .select({ total: count() })
        .from(membershipRequests)
        .where(eq(membershipRequests.status, 'pending')),
      db.select({ total: count() }).from(orderIssues).where(ne(orderIssues.status, 'resolved')),
      db
        .select({ total: count() })
        .from(conversations)
        .where(
          or(
            eq(conversations.status, 'waiting'),
            and(eq(conversations.status, 'admin'), sql`${conversations.unreadByAdmin} > 0`),
          ),
        ),
      // Phiên đã kết thúc, có người thắng, chưa tạo đơn / chưa đánh dấu bỏ cọc.
      db
        .select({ total: count() })
        .from(auctions)
        .leftJoin(auctionFulfillments, eq(auctionFulfillments.auctionId, auctions.id))
        .where(
          and(
            lte(auctions.endAt, now),
            sql`${auctions.bidCount} > 0`,
            isNull(auctionFulfillments.auctionId),
          ),
        ),
      catalog.posts(),
      db
        .select({ total: count() })
        .from(items)
        .where(and(eq(items.status, 'available'), isNull(items.feedId))),
    ],
  );
  return {
    activeOrders: Number(active?.total ?? 0),
    levelRequests: Number(levels?.total ?? 0),
    openIssues: Number(issues?.total ?? 0),
    waitingChats: Number(chats?.total ?? 0),
    awaitingAuctionOrders: Number(awaiting?.total ?? 0),
    leftoverItems: Number(leftovers?.total ?? 0),
    posts,
  };
}

export function adminReportsRouter(db: Db, catalog: FeedCatalog): Router {
  // Gắn ở /api/admin cùng các router admin khác nên kiểm tra quyền ở từng đường.
  const router = Router();

  router.get('/dashboard', requireAdmin, async (req, res) => {
    const { days } = parseInput(rangeSchema, req.query);
    const now = Date.now();
    const start = new Date(now - days * DAY_MS);
    const previousStart = new Date(now - 2 * days * DAY_MS);
    const chartDays = 14;
    const chartStart = new Date(now - chartDays * DAY_MS);

    const [
      statusRows,
      [current],
      [previous],
      dailyRows,
      [available],
      [sold],
      [customerTotals],
      work,
    ] = await Promise.all([
      db
        .select({ status: orders.status, total: count() })
        .from(orders)
        .where(gte(orders.createdAt, start))
        .groupBy(orders.status),
      db
        .select({
          revenue: sum(
            sql`CASE WHEN ${orders.status} IN ('cancelled', 'returned') THEN 0 ELSE ${orders.total} END`,
          ),
        })
        .from(orders)
        .where(gte(orders.createdAt, start)),
      db
        .select({
          orders: count(),
          revenue: sum(
            sql`CASE WHEN ${orders.status} IN ('cancelled', 'returned') THEN 0 ELSE ${orders.total} END`,
          ),
        })
        .from(orders)
        .where(and(gte(orders.createdAt, previousStart), lt(orders.createdAt, start))),
      // Doanh thu theo ngày (giờ Việt Nam), 14 ngày gần nhất.
      db
        .select({
          date: sql<string>`DATE_FORMAT(CONVERT_TZ(${orders.createdAt}, '+00:00', '+07:00'), '%Y-%m-%d')`,
          revenue: sum(orders.total),
          orders: count(),
        })
        .from(orders)
        .where(and(gte(orders.createdAt, chartStart), notVoid))
        .groupBy(sql`1`),
      db
        .select({ total: count() })
        .from(items)
        .where(and(eq(items.status, 'available'), isNotNull(items.feedId))),
      db
        .select({ total: count() })
        .from(items)
        .where(and(eq(items.status, 'sold'), gte(items.soldAt, start))),
      db
        .select({
          total: count(),
          recent: sum(sql`${users.createdAt} >= ${start}`),
        })
        .from(users)
        .where(eq(users.role, 'customer')),
      workloadCounts(db, catalog),
    ]);

    const statusCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const row of statusRows) statusCounts[row.status] = Number(row.total);
    const orderCount = Object.values(statusCounts).reduce((total, value) => total + value, 0);
    const byDate = new Map(dailyRows.map((row) => [row.date, row]));
    const daily = Array.from({ length: chartDays }, (_, index) => {
      const date = vnDateKey(now - (chartDays - 1 - index) * DAY_MS);
      const row = byDate.get(date);
      return { date, revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) };
    });
    const posts = work.posts;
    const stats: DashboardStats = {
      rangeDays: days,
      revenue: Number(current?.revenue ?? 0),
      previousRevenue: Number(previous?.revenue ?? 0),
      orderCount,
      previousOrderCount: Number(previous?.orders ?? 0),
      cancelRate: orderCount === 0 ? 0 : statusCounts.cancelled / orderCount,
      pendingOrders: work.activeOrders,
      statusCounts,
      daily,
      feedCount: posts.length,
      feedLimit: FEED_LIMIT,
      sellingFeeds: posts.filter((feed) => feed.status === 'selling').length,
      upcomingFeeds: posts.filter((feed) => feed.status === 'upcoming').length,
      soldOutFeeds: posts
        .filter((feed) => feed.status === 'sold-out')
        .sort((a, b) => (b.soldOutAt ?? '').localeCompare(a.soldOutAt ?? ''))
        .map((feed) => ({
          id: feed.id,
          number: feed.number,
          title: feed.title,
          itemCount: feed.itemCount,
          revenue: feed.items.reduce((total, item) => total + item.price, 0),
          soldOutAt: feed.soldOutAt,
        })),
      availableItems: Number(available?.total ?? 0),
      soldItems: Number(sold?.total ?? 0),
      leftoverItems: work.leftoverItems,
      pendingLevelRequests: work.levelRequests,
      openIssues: work.openIssues,
      waitingChats: work.waitingChats,
      awaitingAuctionOrders: work.awaitingAuctionOrders,
      customerCount: Number(customerTotals?.total ?? 0),
      newCustomers: Number(customerTotals?.recent ?? 0),
    };
    res.json({ data: stats });
  });

  router.get('/reports/problems', requireAdmin, async (req, res) => {
    const { days } = parseInput(rangeSchema, req.query);
    const start = new Date(Date.now() - days * DAY_MS);
    const [[scope], badOrders, issues] = await Promise.all([
      db.select({ total: count() }).from(orders).where(gte(orders.createdAt, start)),
      loadOrders(db, 'admin', {
        where: and(gte(orders.createdAt, start), inArray(orders.status, ['cancelled', 'returned'])),
      }),
      // Sự cố chưa xử lý xong luôn hiện, bất kể mốc thời gian đang lọc.
      listIssues(db, or(ne(orderIssues.status, 'resolved'), gte(orderIssues.createdAt, start))),
    ]);
    const byNewest = (a: { updatedAt: string }, b: { updatedAt: string }) =>
      b.updatedAt.localeCompare(a.updatedAt);
    const cancelled = badOrders.filter((order) => order.status === 'cancelled').sort(byNewest);
    const returned = badOrders.filter((order) => order.status === 'returned').sort(byNewest);
    const byReason = Object.fromEntries(CANCEL_REASONS.map((reason) => [reason, 0])) as Record<
      CancelReason,
      number
    >;
    for (const order of cancelled) byReason[order.cancelReason ?? 'other'] += 1;
    const issuesByType = Object.fromEntries(ISSUE_TYPES.map((type) => [type, 0])) as Record<
      IssueType,
      number
    >;
    for (const issue of issues) issuesByType[issue.type] += 1;
    const orderCount = Number(scope?.total ?? 0);
    res.json({
      data: {
        days,
        orderCount,
        cancelled,
        returned,
        cancelRate: orderCount === 0 ? 0 : cancelled.length / orderCount,
        lostRevenue: badOrders.reduce((total, order) => total + order.total, 0),
        byReason,
        issues,
        issuesByType,
        openIssueCount: issues.filter((issue) => issue.status !== 'resolved').length,
      },
    });
  });

  // Số đếm trên menu admin: web hỏi thường xuyên nên đệm 5 giây.
  let badgeCache: { until: number; data: unknown } | null = null;
  router.get('/badges', requireAdmin, async (_req, res) => {
    if (badgeCache && Date.now() < badgeCache.until) {
      res.json({ data: badgeCache.data });
      return;
    }
    const work = await workloadCounts(db, catalog);
    const data = {
      activeOrders: work.activeOrders,
      awaitingAuctionOrders: work.awaitingAuctionOrders,
      soldOutFeeds: work.posts.filter((feed) => feed.status === 'sold-out').length,
      feedLimitReached: work.posts.length >= FEED_LIMIT,
      leftoverItems: work.leftoverItems,
      levelRequests: work.levelRequests,
      openIssues: work.openIssues,
      waitingChats: work.waitingChats,
    };
    badgeCache = { until: Date.now() + 5_000, data };
    res.json({ data });
  });

  return router;
}

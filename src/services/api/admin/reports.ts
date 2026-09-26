import type {
  ApiResponse,
  CancelReason,
  DashboardStats,
  IssueStatus,
  IssueType,
  Order,
  OrderIssue,
  OrderStatus,
} from '@/types';
import { CANCEL_REASONS, ISSUE_TYPES, ORDER_STATUSES } from '@/types';
import { ACTIVE_ORDER_STATUSES } from '@/constants/orders';
import { createId, hydrateOrder, listAllProducts, readDb, updateDb } from '@/mocks/db';
import { listAuctionsSnapshot } from '../auctionService';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { DAY_MS, isRevenueOrder, stockLevelOf, vnDateKey, withinDays } from './shared';

/* ============================================================
   Tổng quan
   ============================================================ */

export async function getDashboardStats(rangeDays = 30): Promise<DashboardStats> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<DashboardStats>>('/admin/dashboard', {
      params: { days: rangeDays },
    });
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const now = Date.now();
  const start = now - rangeDays * DAY_MS;
  const previousStart = start - rangeDays * DAY_MS;

  const inRange = db.orders.filter((order) => new Date(order.createdAt).getTime() >= start);
  const inPrevious = db.orders.filter((order) => {
    const at = new Date(order.createdAt).getTime();
    return at >= previousStart && at < start;
  });

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  inRange.forEach((order) => {
    statusCounts[order.status] += 1;
  });

  // Doanh thu theo ngày: luôn 14 ngày gần nhất để biểu đồ gọn, dễ đọc.
  const chartDays = 14;
  const daily = Array.from({ length: chartDays }, (_, index) => {
    const date = vnDateKey(now - (chartDays - 1 - index) * DAY_MS);
    const orders = db.orders.filter(
      (order) => vnDateKey(order.createdAt) === date && isRevenueOrder(order),
    );
    return {
      date,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      orders: orders.length,
    };
  });

  const threshold = db.shopSettings.lowStockThreshold;
  const products = listAllProducts(db);
  const auctions = listAuctionsSnapshot(now);
  const fulfilledIds = new Set(db.auctionFulfillments.map((item) => item.auctionId));
  const customers = db.users.filter((user) => user.role === 'customer');

  const revenueOf = (orders: typeof inRange): number =>
    orders.filter(isRevenueOrder).reduce((sum, order) => sum + order.total, 0);

  return mockDelay(
    {
      rangeDays,
      revenue: revenueOf(inRange),
      previousRevenue: revenueOf(inPrevious),
      orderCount: inRange.length,
      previousOrderCount: inPrevious.length,
      cancelRate: inRange.length === 0 ? 0 : statusCounts.cancelled / inRange.length,
      pendingOrders: db.orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
        .length,
      statusCounts,
      daily,
      stockUnits: products.reduce((sum, product) => sum + product.stock, 0),
      lowStockCount: products.filter((product) => stockLevelOf(product, threshold) === 'low')
        .length,
      outOfStockCount: products.filter((product) => stockLevelOf(product, threshold) === 'out')
        .length,
      openIssues: db.issues.filter((issue) => issue.status !== 'resolved').length,
      waitingChats: db.conversations.filter(
        (item) => item.status === 'waiting' || (item.status === 'admin' && item.unreadByAdmin > 0),
      ).length,
      awaitingAuctionOrders: auctions.filter(
        (auction) =>
          auction.status === 'ended' && auction.bids.length > 0 && !fulfilledIds.has(auction.id),
      ).length,
      customerCount: customers.length,
      newCustomers: customers.filter((user) => withinDays(user.createdAt, rangeDays, now)).length,
    },
    300,
  );
}

/* ============================================================
   Báo cáo huỷ đơn & sự cố
   ============================================================ */

export interface ProblemReport {
  days: number;
  orderCount: number;
  cancelled: Order[];
  returned: Order[];
  cancelRate: number;
  lostRevenue: number;
  byReason: Record<CancelReason, number>;
  issues: OrderIssue[];
  issuesByType: Record<IssueType, number>;
  openIssueCount: number;
}

export async function getProblemReport(days = 30): Promise<ProblemReport> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ProblemReport>>('/admin/reports/problems', {
      params: { days },
    });
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const products = listAllProducts(db);
  const scoped = db.orders.filter((order) => withinDays(order.createdAt, days));
  const cancelled = scoped.filter((order) => order.status === 'cancelled');
  const returned = scoped.filter((order) => order.status === 'returned');

  const byReason = Object.fromEntries(CANCEL_REASONS.map((reason) => [reason, 0])) as Record<
    CancelReason,
    number
  >;
  cancelled.forEach((order) => {
    byReason[order.cancelReason ?? 'other'] += 1;
  });

  // Sự cố chưa xử lý xong luôn hiện, bất kể mốc thời gian đang lọc.
  const issues = db.issues
    .filter((issue) => issue.status !== 'resolved' || withinDays(issue.createdAt, days))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const issuesByType = Object.fromEntries(ISSUE_TYPES.map((type) => [type, 0])) as Record<
    IssueType,
    number
  >;
  issues.forEach((issue) => {
    issuesByType[issue.type] += 1;
  });

  const byNewest = (a: { updatedAt: string }, b: { updatedAt: string }): number =>
    b.updatedAt.localeCompare(a.updatedAt);

  return mockDelay(
    {
      days,
      orderCount: scoped.length,
      cancelled: [...cancelled].sort(byNewest).map((order) => hydrateOrder(order, products)),
      returned: [...returned].sort(byNewest).map((order) => hydrateOrder(order, products)),
      cancelRate: scoped.length === 0 ? 0 : cancelled.length / scoped.length,
      lostRevenue: [...cancelled, ...returned].reduce((sum, order) => sum + order.total, 0),
      byReason,
      issues,
      issuesByType,
      openIssueCount: issues.filter((issue) => issue.status !== 'resolved').length,
    },
    300,
  );
}

export interface IssueInput {
  orderId: string;
  type: IssueType;
  description: string;
  reportedBy: OrderIssue['reportedBy'];
}

export async function createIssue(input: IssueInput): Promise<OrderIssue> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<OrderIssue>>('/admin/issues', input);
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const order = db.orders.find((item) => item.id === input.orderId);
  if (!order) throw new MockApiError('Không tìm thấy đơn hàng để gắn sự cố.', 404);
  const customerName =
    db.users.find((user) => user.id === order.userId)?.fullName ?? order.receiverName;
  const now = new Date().toISOString();

  const issue: OrderIssue = {
    id: createId('iss'),
    orderId: order.id,
    orderCode: order.code,
    customerName,
    type: input.type,
    status: 'open',
    description: input.description.trim(),
    reportedBy: input.reportedBy,
    createdAt: now,
    updatedAt: now,
  };
  updateDb((draft) => {
    draft.issues.unshift(issue);
  });
  return mockDelay(issue, 400);
}

export async function updateIssue(
  issueId: string,
  patch: { status: IssueStatus; resolution?: string },
): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/admin/issues/${issueId}`, patch);
    return;
  }
  requireAdmin();
  if (patch.status === 'resolved' && !patch.resolution?.trim()) {
    throw new MockApiError('Ghi lại cách đã xử lý trước khi đóng sự cố.', 422, {
      resolution: 'Ghi lại cách đã xử lý trước khi đóng sự cố.',
    });
  }
  updateDb((db) => {
    const issue = db.issues.find((item) => item.id === issueId);
    if (!issue) throw new MockApiError('Không tìm thấy sự cố này.', 404);
    issue.status = patch.status;
    issue.resolution = patch.resolution?.trim() || issue.resolution;
    issue.updatedAt = new Date().toISOString();
  });
  await mockDelay(null, 300);
}

export async function listIssuesForOrder(orderId: string): Promise<OrderIssue[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<OrderIssue[]>>(
      `/admin/orders/${orderId}/issues`,
    );
    return data.data;
  }
  requireAdmin();
  return mockDelay(
    readDb().issues.filter((issue) => issue.orderId === orderId),
    160,
  );
}

/* ============================================================
   Số đếm cho thanh điều hướng quản trị
   ============================================================ */

export interface AdminBadges {
  activeOrders: number;
  awaitingAuctionOrders: number;
  stockAlerts: number;
  openIssues: number;
  waitingChats: number;
}

export async function getAdminBadges(): Promise<AdminBadges> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminBadges>>('/admin/badges');
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const threshold = db.shopSettings.lowStockThreshold;
  const fulfilled = new Set(db.auctionFulfillments.map((item) => item.auctionId));
  return mockDelay(
    {
      activeOrders: db.orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
        .length,
      awaitingAuctionOrders: listAuctionsSnapshot().filter(
        (auction) =>
          auction.status === 'ended' && auction.bids.length > 0 && !fulfilled.has(auction.id),
      ).length,
      stockAlerts: listAllProducts(db).filter(
        (product) => stockLevelOf(product, threshold) !== 'in-stock',
      ).length,
      openIssues: db.issues.filter((issue) => issue.status !== 'resolved').length,
      waitingChats: db.conversations.filter(
        (item) => item.status === 'waiting' || (item.status === 'admin' && item.unreadByAdmin > 0),
      ).length,
    },
    60,
  );
}

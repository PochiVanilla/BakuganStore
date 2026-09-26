import type {
  AdminCustomer,
  AdminCustomerStats,
  Auction,
  Order,
  Product,
  StockLevel,
} from '@/types';
import { VOID_ORDER_STATUSES } from '@/constants/orders';
import type { StoredOrder, UserRecord } from '@/mocks/db';

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** "2026-09-26" theo giờ Việt Nam — dùng để gom số liệu theo ngày. */
export function vnDateKey(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: VN_TIME_ZONE });
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Có nằm trong `days` ngày gần nhất không (days <= 0 nghĩa là mọi thời điểm). */
export function withinDays(iso: string, days: number, now: number = Date.now()): boolean {
  if (days <= 0) return true;
  return now - new Date(iso).getTime() <= days * DAY_MS;
}

export function isRevenueOrder(order: Pick<Order, 'status'>): boolean {
  return !VOID_ORDER_STATUSES.includes(order.status);
}

export function stockLevelOf(product: Pick<Product, 'stock'>, threshold: number): StockLevel {
  if (product.stock <= 0) return 'out';
  if (product.stock <= threshold) return 'low';
  return 'in-stock';
}

export function customerStats(
  userId: string,
  orders: readonly StoredOrder[],
  auctions: readonly Auction[],
): AdminCustomerStats {
  const mine = orders.filter((order) => order.userId === userId);
  const lastOrderAt = mine.reduce<string | undefined>(
    (latest, order) => (!latest || order.createdAt > latest ? order.createdAt : latest),
    undefined,
  );
  let auctionBidCount = 0;
  let auctionWinCount = 0;
  auctions.forEach((auction) => {
    const bids = auction.bids.filter((bid) => bid.bidderId === userId).length;
    auctionBidCount += bids;
    if (auction.status === 'ended' && auction.bids[0]?.bidderId === userId) auctionWinCount += 1;
  });

  return {
    orderCount: mine.length,
    completedCount: mine.filter((order) => order.status === 'completed').length,
    cancelledCount: mine.filter((order) => order.status === 'cancelled').length,
    totalSpent: mine.filter(isRevenueOrder).reduce((sum, order) => sum + order.total, 0),
    lastOrderAt,
    auctionBidCount,
    auctionWinCount,
  };
}

/**
 * Chuyển bản ghi người dùng thành hồ sơ admin được xem.
 *
 * Viết theo kiểu *liệt kê trường được phép*: `bankAccount.accountNumber` không
 * bao giờ được sao chép sang, và trường nhạy cảm thêm sau này cũng không tự lọt.
 */
export function toAdminCustomer(
  record: UserRecord,
  orders: readonly StoredOrder[],
  auctions: readonly Auction[],
): AdminCustomer {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    avatarUrl: record.avatarUrl,
    role: record.role,
    status: record.status,
    lockedReason: record.lockedReason,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
    birthday: record.birthday,
    gender: record.gender,
    addresses: record.addresses,
    tags: record.tags,
    adminNote: record.adminNote,
    bankLink: record.bankAccount
      ? { bankName: record.bankAccount.bankName, accountHolder: record.bankAccount.accountHolder }
      : null,
    stats: customerStats(record.id, orders, auctions),
  };
}

/** Mã đơn dạng TD2609K42, kiểm tra trùng trong danh sách hiện có. */
export function generateOrderCode(
  existing: readonly Pick<Order, 'code'>[],
  at = new Date(),
): string {
  const taken = new Set(existing.map((order) => order.code));
  const [, month, day] = vnDateKey(at).split('-');
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digits = String(10 + Math.floor(Math.random() * 90));
    const code = `TD${day}${month}${letter}${digits}`;
    if (!taken.has(code)) return code;
  }
  return `TD${Date.now().toString(36).toUpperCase()}`;
}

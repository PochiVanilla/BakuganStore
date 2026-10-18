import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  sum,
  type SQL,
} from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { feeds, items, orders } from '../../db/schema';
import { normalizeSearch } from '../../shared/catalog';
import { BAKUGAN_ATTRIBUTES, type AdminItem, type Paginated } from '../../shared/types';
import { toAdminItem } from './dto';
import { loadAdminItems } from './store';

/*
 * Trang Kho của admin: lọc, tìm, đếm và phân trang bằng SQL (số con tăng dần theo năm tháng,
 * không kéo cả bảng về). Kết quả giống bản giả lập (src/services/api/admin/items.ts).
 * Tìm kiếm không cần bỏ dấu ở cột tên feed / người mua: bảng dùng utf8mb4_0900_ai_ci nên
 * MySQL tự so khớp không phân biệt dấu và hoa thường ("duc" khớp "Đức").
 */

export const ADMIN_ITEM_FILTERS = ['all', 'available', 'sold', 'leftover'] as const;
export type AdminItemFilter = (typeof ADMIN_ITEM_FILTERS)[number];

export const adminItemQuerySchema = z.object({
  status: z.enum(ADMIN_ITEM_FILTERS).default('all'),
  keyword: z.string().max(100).default(''),
  attribute: z.enum(['all', ...BAKUGAN_ATTRIBUTES]).default('all'),
  soldWithinDays: z.coerce.number().int().min(0).max(3_650).default(0),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminItemQuery = z.infer<typeof adminItemQuerySchema>;

export interface AdminItemList {
  page: Paginated<AdminItem>;
  counts: Record<AdminItemFilter, number>;
  /** Tổng tiền các con đã bán khớp bộ lọc */
  soldValue: number;
}

/** Từ khoá cho LIKE: thoát các ký tự đặc biệt %, _ và \ */
export function likePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Nhóm của một con: đã bán / đang bán trên feed / hàng tồn */
const bucket = sql<AdminItemFilter>`CASE WHEN ${items.status} = 'sold' THEN 'sold' WHEN ${items.feedId} IS NULL THEN 'leftover' ELSE 'available' END`;

function filterCondition(status: AdminItemFilter): SQL | undefined {
  switch (status) {
    case 'sold':
      return eq(items.status, 'sold');
    case 'available':
      return and(eq(items.status, 'available'), isNotNull(items.feedId));
    case 'leftover':
      return and(eq(items.status, 'available'), isNull(items.feedId));
    default:
      return undefined;
  }
}

/** Điều kiện chung cho cả số đếm từng nhóm lẫn danh sách (hệ, thời gian bán, từ khoá). */
function scopeCondition(query: AdminItemQuery): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];
  if (query.attribute !== 'all') conditions.push(eq(items.attributeKey, query.attribute));
  if (query.soldWithinDays > 0) {
    conditions.push(
      or(
        ne(items.status, 'sold'),
        gte(items.soldAt, sql`UTC_TIMESTAMP(3) - INTERVAL ${query.soldWithinDays} DAY`),
      ),
    );
  }
  const needle = normalizeSearch(query.keyword);
  if (needle) {
    const pattern = likePattern(needle);
    conditions.push(
      or(
        sql`${items.searchText} LIKE ${pattern}`,
        sql`COALESCE(${feeds.title}, ${items.feedTitleSnapshot}) LIKE ${pattern}`,
        sql`COALESCE(${orders.receiverName}, ${items.buyerName}) LIKE ${pattern}`,
        sql`${orders.code} LIKE ${pattern}`,
      ),
    );
  }
  return and(...conditions);
}

export async function listAdminItems(db: Db, query: AdminItemQuery): Promise<AdminItemList> {
  const scope = scopeCondition(query);
  const where = and(scope, filterCondition(query.status));

  const bucketRows = await db
    .select({ bucket, total: count() })
    .from(items)
    .leftJoin(orders, eq(orders.id, items.orderId))
    .leftJoin(feeds, eq(feeds.id, items.feedId))
    .where(scope)
    .groupBy(bucket);
  const counts: Record<AdminItemFilter, number> = { all: 0, available: 0, sold: 0, leftover: 0 };
  for (const row of bucketRows) {
    counts[row.bucket] = Number(row.total);
    counts.all += Number(row.total);
  }

  const [totals] = await db
    .select({
      total: count(),
      soldValue: sum(sql`CASE WHEN ${items.status} = 'sold' THEN ${items.price} ELSE 0 END`),
    })
    .from(items)
    .leftJoin(orders, eq(orders.id, items.orderId))
    .leftJoin(feeds, eq(feeds.id, items.feedId))
    .where(where);
  const total = Number(totals?.total ?? 0);

  const loaded = await loadAdminItems(db, {
    where,
    orderBy: query.status === 'sold' ? [desc(items.soldAt), desc(items.code)] : [desc(items.code)],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const now = Date.now();
  return {
    counts,
    soldValue: Number(totals?.soldValue ?? 0),
    page: {
      items: loaded.map((row) => toAdminItem(row.item, row.feed, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/** Hàng tồn: con chưa bán không thuộc feed nào — để đưa vào feed mới. */
export async function listLeftoverItems(db: Db): Promise<AdminItem[]> {
  const loaded = await loadAdminItems(db, {
    where: and(eq(items.status, 'available'), isNull(items.feedId)),
    orderBy: [asc(items.code)],
  });
  const now = Date.now();
  return loaded.map((row) => toAdminItem(row.item, row.feed, now));
}

/** Con còn bán (trên feed hoặc hàng tồn) — để admin chọn khi tạo đơn. Tối đa 30. */
export async function listSellableItems(db: Db, keyword: string): Promise<AdminItem[]> {
  const needle = normalizeSearch(keyword);
  const loaded = await loadAdminItems(db, {
    where: and(
      eq(items.status, 'available'),
      needle ? sql`${items.searchText} LIKE ${likePattern(needle)}` : undefined,
    ),
    orderBy: [desc(items.code)],
    limit: 30,
  });
  const now = Date.now();
  return loaded.map((row) => toAdminItem(row.item, row.feed, now));
}

/** Số con hàng tồn (hiện trên trang danh sách feed) */
export async function countLeftovers(db: Db): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(items)
    .where(and(eq(items.status, 'available'), isNull(items.feedId)));
  return Number(row?.total ?? 0);
}

import { asc, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { feeds, items, orders } from '../../db/schema';
import type { Tx } from '../../db/tx';
import type { FeedPost } from '../../shared/types';
import { toFeedPost, type AdminItemRow, type FeedRef, type FeedRow, type ItemRow } from './dto';

/** Feed đang có trên web (chưa gỡ), mới nhất trước. */
export function activeFeeds(executor: Db | Tx): Promise<FeedRow[]> {
  return executor.select().from(feeds).where(isNull(feeds.retiredAt)).orderBy(desc(feeds.number));
}

/** Các con của những feed này, nhóm theo feed và xếp đúng thứ tự trong feed. */
export async function itemsByFeed(
  executor: Db | Tx,
  feedIds: readonly string[],
): Promise<Map<string, ItemRow[]>> {
  if (feedIds.length === 0) return new Map();
  const rows = await executor
    .select()
    .from(items)
    .where(inArray(items.feedId, [...feedIds]))
    .orderBy(asc(items.position), asc(items.code));
  return groupByFeed(rows);
}

export interface LoadedAdminItem {
  item: AdminItemRow;
  /** Feed đang chứa con này (trống = hàng tồn hoặc con đã bán của feed đã gỡ) */
  feed: FeedRef | undefined;
}

/** Con Bakugan kèm feed đang chứa nó và mã đơn / người nhận của đơn đã mua nó (cho admin). */
export async function loadAdminItems(
  executor: Db | Tx,
  options: { where?: SQL; orderBy?: SQL[]; limit?: number; offset?: number } = {},
): Promise<LoadedAdminItem[]> {
  const query = executor
    .select({
      item: items,
      orderCode: orders.code,
      orderReceiver: orders.receiverName,
      feedNumber: feeds.number,
      feedTitle: feeds.title,
      feedOpensAt: feeds.opensAt,
    })
    .from(items)
    .leftJoin(orders, eq(orders.id, items.orderId))
    .leftJoin(feeds, eq(feeds.id, items.feedId))
    .where(options.where)
    .orderBy(...(options.orderBy ?? [asc(items.position), asc(items.code)]))
    .$dynamic();
  if (options.limit !== undefined) query.limit(options.limit).offset(options.offset ?? 0);
  const rows = await query;
  return rows.map((row) => ({
    item: { ...row.item, orderCode: row.orderCode, orderReceiver: row.orderReceiver },
    feed:
      row.feedNumber !== null && row.feedTitle !== null && row.feedOpensAt !== null
        ? { number: row.feedNumber, title: row.feedTitle, opensAt: row.feedOpensAt }
        : undefined,
  }));
}

/** Nhóm con theo feed (giữ thứ tự sẵn có). */
export function groupByFeed<T extends ItemRow>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.feedId) continue;
    const list = grouped.get(row.feedId);
    if (list) list.push(row);
    else grouped.set(row.feedId, [row]);
  }
  return grouped;
}

/** Bao lâu thì đọc lại danh sách feed (trang chủ, trang Feed, giỏ hàng gọi rất nhiều) */
const CACHE_MS = 5_000;

/**
 * Danh sách feed phía khách, đệm trong bộ nhớ vài giây. Xoá đệm ngay khi admin sửa feed /
 * từng con, hoặc có đơn mới (gọi `invalidate`). Đệm cũng hết hạn đúng lúc feed sắp mở bán
 * tới giờ, để trạng thái "sắp mở bán" chuyển thành "đang bán" đúng giờ.
 */
export class FeedCatalog {
  private cached: { validUntil: number; posts: FeedPost[] } | null = null;
  private pending: Promise<FeedPost[]> | null = null;
  private generation = 0;

  constructor(
    private readonly db: Db,
    private readonly cacheMs = CACHE_MS,
  ) {}

  invalidate(): void {
    this.cached = null;
    this.pending = null;
    this.generation += 1;
  }

  /** Mọi feed đang có trên web, mới nhất trước. */
  async posts(): Promise<FeedPost[]> {
    if (this.cached && Date.now() < this.cached.validUntil) return this.cached.posts;
    if (this.pending) return this.pending;
    const generation = this.generation;
    const pending = this.build().then((result) => {
      // Admin vừa sửa trong lúc đang đọc thì không giữ bản này.
      if (generation === this.generation) this.cached = result;
      return result.posts;
    });
    this.pending = pending;
    try {
      return await pending;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }

  private async build(): Promise<{ validUntil: number; posts: FeedPost[] }> {
    const feedRows = await activeFeeds(this.db);
    const grouped = await itemsByFeed(
      this.db,
      feedRows.map((feed) => feed.id),
    );
    const now = Date.now();
    const posts = feedRows.map((feed) => toFeedPost(feed, grouped.get(feed.id) ?? [], now));
    const nextOpening = feedRows
      .map((feed) => feed.opensAt.getTime())
      .filter((time) => time > now)
      .reduce((soonest, time) => Math.min(soonest, time), Number.POSITIVE_INFINITY);
    return { validUntil: Math.min(now + this.cacheMs, nextOpening), posts };
  }
}

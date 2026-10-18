import type { feeds, items } from '../../db/schema';
import type { AdminFeed, AdminItem, BakuganItem, FeedPost } from '../../shared/types';

/*
 * Đổi dòng CSDL thành dữ liệu web dùng — đúng như bản giả lập (src/mocks/db.ts:
 * toPublicItem, toFeedPost; src/services/api/admin/feeds.ts: toAdminItem, toAdminFeed).
 * Bản cho khách chọn từng trường: không có người mua, đơn, ghi chú, giá nhập, nhà cung cấp.
 */

export type FeedRow = typeof feeds.$inferSelect;
export type ItemRow = typeof items.$inferSelect;

/** Con Bakugan kèm mã đơn và tên người nhận của đơn đã mua nó (chỉ admin thấy) */
export interface AdminItemRow extends ItemRow {
  orderCode: string | null;
  orderReceiver: string | null;
}

export type FeedRef = Pick<FeedRow, 'number' | 'title' | 'opensAt'>;

export function isFeedOpen(feed: Pick<FeedRow, 'opensAt'>, now: number): boolean {
  return feed.opensAt.getTime() <= now;
}

export function toPublicItem(item: ItemRow, feed: FeedRef | undefined, now: number): BakuganItem {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    price: item.price,
    attribute: item.attribute,
    series: item.series ?? undefined,
    condition: item.condition ?? undefined,
    images: item.photos,
    image: item.photos[0] ?? '',
    video: item.video ?? undefined,
    status: item.status,
    soldAt: item.soldAt?.toISOString(),
    feedId: item.feedId ?? undefined,
    feedNumber: feed?.number ?? item.feedNumberSnapshot ?? undefined,
    feedTitle: feed?.title ?? item.feedTitleSnapshot ?? undefined,
    feedOpensAt: feed?.opensAt.toISOString(),
    onSale: item.status === 'available' && Boolean(feed) && isFeedOpen(feed!, now),
    createdAt: item.createdAt.toISOString(),
  };
}

/** Phần chung của feed (khách và admin), `items` đã xếp theo thứ tự trong feed. */
function feedSummary(feed: FeedRow, items: readonly ItemRow[], now: number) {
  const soldCount = items.filter((item) => item.status === 'sold').length;
  const available = items.filter((item) => item.status === 'available');
  const soldOut = items.length > 0 && available.length === 0;
  const prices = available.map((item) => item.price);
  const lastSale = items.reduce<Date | undefined>(
    (latest, item) => (item.soldAt && (!latest || item.soldAt > latest) ? item.soldAt : latest),
    undefined,
  );
  return {
    id: feed.id,
    number: feed.number,
    title: feed.title,
    caption: feed.caption,
    images: feed.images,
    publishedAt: feed.publishedAt.toISOString(),
    opensAt: feed.opensAt.toISOString(),
    status: !isFeedOpen(feed, now) ? 'upcoming' : soldOut ? 'sold-out' : 'selling',
    itemCount: items.length,
    soldCount,
    soldOutAt: soldOut ? lastSale?.toISOString() : undefined,
    priceRange:
      prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined,
  } satisfies Omit<FeedPost, 'items'>;
}

export function toFeedPost(feed: FeedRow, items: readonly ItemRow[], now: number): FeedPost {
  return {
    ...feedSummary(feed, items, now),
    items: items.map((item) => toPublicItem(item, feed, now)),
  };
}

export function toAdminItem(item: AdminItemRow, feed: FeedRef | undefined, now: number): AdminItem {
  return {
    ...toPublicItem(item, feed, now),
    soldVia: item.status === 'sold' ? (item.soldVia ?? undefined) : undefined,
    orderId: item.orderId ?? undefined,
    orderCode: item.orderCode ?? undefined,
    buyerName: item.orderReceiver ?? item.buyerName ?? undefined,
    soldNote: item.soldNote ?? undefined,
  };
}

export function toAdminFeed(feed: FeedRow, items: readonly AdminItemRow[], now: number): AdminFeed {
  return {
    ...feedSummary(feed, items, now),
    items: items.map((item) => toAdminItem(item, feed, now)),
    revenue: items
      .filter((item) => item.status === 'sold')
      .reduce((sum, item) => sum + item.price, 0),
    lotCost: feed.lotCost ?? undefined,
    supplier: feed.supplier ?? undefined,
  };
}

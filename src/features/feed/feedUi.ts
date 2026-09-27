import type { BakuganAttribute, FeedPost, FeedStatus } from '@/types';
import type { StatusBadgeType } from '@/components/ui';

export const FEED_BADGE: Record<FeedStatus, StatusBadgeType> = {
  upcoming: 'UPCOMING',
  selling: 'SELLING',
  'sold-out': 'SOLD_OUT',
};

/** Các hệ có trong feed, giữ thứ tự xuất hiện. */
export function attributesOf(feed: Pick<FeedPost, 'items'>): BakuganAttribute[] {
  return [...new Set(feed.items.map((item) => item.attribute))];
}

import type { BakuganAttribute, FeedPost, FeedStatus } from '@/types';
import type { StatusBadgeType } from '@/components/ui';
import { attributeKeyOf } from '@/constants/catalog';

export const FEED_BADGE: Record<FeedStatus, StatusBadgeType> = {
  upcoming: 'UPCOMING',
  selling: 'SELLING',
  'sold-out': 'SOLD_OUT',
};

/** Các hệ quen thuộc có trong feed (để hiện icon), giữ thứ tự xuất hiện. */
export function attributesOf(feed: Pick<FeedPost, 'items'>): BakuganAttribute[] {
  const keys = feed.items.map((item) => attributeKeyOf(item.attribute));
  return [...new Set(keys.filter((key): key is BakuganAttribute => Boolean(key)))];
}

import type { ApiResponse, BakuganItem, FeedPost, FeedQuery, ItemQuery } from '@/types';
import { listFeedPosts } from '@/mocks/db';
import { normalizeSearch } from '@/utils/slugify';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';

/* ============================================================
   Feed bán hàng phía khách.

   Mỗi feed là một lô Bakugan: ảnh chụp cả lô + danh sách từng con,
   mỗi con một mã riêng (BK-0231). Khách chỉ thấy feed đang có trên
   web; hàng tồn chưa đăng lại và thông tin người mua không lộ ra.
   ============================================================ */

function itemHaystack(item: BakuganItem): string {
  return normalizeSearch(`${item.name} ${item.code} ${item.code.replace('-', '')}`);
}

function matchesItem(item: BakuganItem, query: ItemQuery): boolean {
  if (!query.includeSold && item.status !== 'available') return false;
  if (query.attributes?.length && !query.attributes.includes(item.attribute)) return false;
  if (query.conditions?.length && !query.conditions.includes(item.condition)) return false;
  if (query.minPrice !== undefined && item.price < query.minPrice) return false;
  if (query.maxPrice !== undefined && item.price > query.maxPrice) return false;
  if (query.keyword) {
    const needle = normalizeSearch(query.keyword);
    if (needle && !itemHaystack(item).includes(needle)) return false;
  }
  return true;
}

export async function fetchFeeds(query: FeedQuery = {}): Promise<FeedPost[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<FeedPost[]>>('/feeds', { params: query });
    return data.data;
  }
  const needle = query.keyword ? normalizeSearch(query.keyword) : '';
  const feeds = listFeedPosts().filter((feed) => {
    if (query.status && query.status !== 'all' && feed.status !== query.status) return false;
    if (query.attribute && !feed.items.some((item) => item.attribute === query.attribute)) {
      return false;
    }
    if (!needle) return true;
    return (
      normalizeSearch(`${feed.title} feed ${feed.number}`).includes(needle) ||
      feed.items.some((item) => itemHaystack(item).includes(needle))
    );
  });
  return mockDelay(query.limit ? feeds.slice(0, query.limit) : feeds, 240);
}

/** Trang chủ: tối đa 10 feed mới nhất. */
export async function fetchLatestFeeds(limit = 10): Promise<FeedPost[]> {
  return fetchFeeds({ limit });
}

export async function fetchFeedByNumber(number: number): Promise<FeedPost> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<FeedPost>>(`/feeds/${number}`);
    return data.data;
  }
  const feed = listFeedPosts().find((item) => item.number === number);
  if (!feed) {
    throw new MockApiError(
      'Không tìm thấy feed này. Có thể feed đã bán hết và được shop gỡ khỏi web.',
      404,
    );
  }
  return mockDelay(feed, 220);
}

/** Tìm Bakugan trên mọi feed đang có (mặc định chỉ con còn bán). */
export async function searchItems(query: ItemQuery = {}): Promise<BakuganItem[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BakuganItem[]>>('/feeds/items', {
      params: query,
    });
    return data.data;
  }
  const items = listFeedPosts()
    .flatMap((feed) => feed.items)
    .filter((item) => matchesItem(item, query));
  return mockDelay(query.limit ? items.slice(0, query.limit) : items, 200);
}

/** Lấy lại trạng thái mới nhất của vài con (giỏ hàng, yêu thích). */
export async function fetchItemsByIds(ids: readonly string[]): Promise<BakuganItem[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BakuganItem[]>>('/feeds/items/by-ids', {
      params: { ids: ids.join(',') },
    });
    return data.data;
  }
  const wanted = new Set(ids);
  return mockDelay(
    listFeedPosts()
      .flatMap((feed) => feed.items)
      .filter((item) => wanted.has(item.id)),
    160,
  );
}

export interface SearchSuggestions {
  items: BakuganItem[];
  feeds: FeedPost[];
}

/** Gợi ý nhanh cho ô tìm kiếm ở header: Bakugan khớp tên / mã và feed khớp tiêu đề. */
export async function searchSuggestions(keyword: string, limit = 6): Promise<SearchSuggestions> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<SearchSuggestions>>('/feeds/suggestions', {
      params: { keyword, limit },
    });
    return data.data;
  }
  const needle = normalizeSearch(keyword);
  if (needle.length < 2) return mockDelay({ items: [], feeds: [] }, 60);
  const feeds = listFeedPosts();
  const items = feeds
    .flatMap((feed) => feed.items)
    .filter((item) => itemHaystack(item).includes(needle))
    // Con còn bán lên trước
    .sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold'))
    .slice(0, limit);
  const matchedFeeds = feeds
    .filter((feed) => normalizeSearch(`${feed.title} feed ${feed.number}`).includes(needle))
    .slice(0, 3);
  return mockDelay({ items, feeds: matchedFeeds }, 120);
}

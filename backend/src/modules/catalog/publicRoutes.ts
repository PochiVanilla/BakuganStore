import { Router } from 'express';
import { z } from 'zod';
import { notFound, parseInput } from '../../lib/errors';
import { attributeKeyOf, normalizeItemCode, normalizeSearch } from '../../shared/catalog';
import {
  BAKUGAN_ATTRIBUTES,
  FEED_STATUS_FILTERS,
  type BakuganItem,
  type FeedPost,
} from '../../shared/types';
import type { FeedCatalog } from './store';

/*
 * /api/feeds — feed bán hàng phía khách, ai cũng xem được.
 * Lọc và sắp xếp đúng như bản giả lập (src/services/api/feedService.ts). Khách chỉ thấy
 * feed đang có trên web; hàng tồn chưa đăng lại và thông tin người mua không lộ ra.
 */

const attribute = z.enum(BAKUGAN_ATTRIBUTES);
const keyword = z.string().max(100).optional();
const limit = z.coerce.number().int().min(1).max(200).optional();

const feedQuerySchema = z.object({
  status: z.enum(FEED_STATUS_FILTERS).optional(),
  keyword,
  attribute: attribute.optional(),
  limit,
});

const itemQuerySchema = z.object({
  keyword,
  // axios gửi mảng dạng attributes[]=pyrus&attributes[]=aquos; một giá trị thì là chuỗi.
  attributes: z
    .union([attribute, z.array(attribute).max(BAKUGAN_ATTRIBUTES.length)])
    .optional()
    .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  includeSold: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit,
});

const byIdsSchema = z.object({
  ids: z
    .string()
    .max(100 * 37)
    .optional()
    .transform((value) => (value ?? '').split(',').filter(Boolean))
    .pipe(z.array(z.string().max(36)).max(100, 'Tối đa 100 con mỗi lần.')),
});

const suggestionSchema = z.object({
  keyword: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

function itemHaystack(item: BakuganItem): string {
  return normalizeSearch(`${item.name} ${item.code} ${item.code.replace('-', '')}`);
}

function feedHaystack(feed: FeedPost): string {
  return normalizeSearch(`${feed.title} feed ${feed.number}`);
}

export function feedsRouter(catalog: FeedCatalog): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseInput(feedQuerySchema, req.query);
    const needle = query.keyword ? normalizeSearch(query.keyword) : '';
    const feeds = (await catalog.posts()).filter((feed) => {
      if (query.status && query.status !== 'all' && feed.status !== query.status) return false;
      if (
        query.attribute &&
        !feed.items.some((item) => attributeKeyOf(item.attribute) === query.attribute)
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        feedHaystack(feed).includes(needle) ||
        feed.items.some((item) => itemHaystack(item).includes(needle))
      );
    });
    res.json({ data: query.limit ? feeds.slice(0, query.limit) : feeds });
  });

  router.get('/items', async (req, res) => {
    const query = parseInput(itemQuerySchema, req.query);
    const needle = query.keyword ? normalizeSearch(query.keyword) : '';
    const found = (await catalog.posts())
      .flatMap((feed) => feed.items)
      .filter((item) => {
        if (!query.includeSold && item.status !== 'available') return false;
        if (query.attributes.length > 0) {
          const key = attributeKeyOf(item.attribute);
          if (!key || !query.attributes.includes(key)) return false;
        }
        if (query.minPrice !== undefined && item.price < query.minPrice) return false;
        if (query.maxPrice !== undefined && item.price > query.maxPrice) return false;
        return !needle || itemHaystack(item).includes(needle);
      });
    res.json({ data: query.limit ? found.slice(0, query.limit) : found });
  });

  router.get('/items/by-ids', async (req, res) => {
    const { ids } = parseInput(byIdsSchema, req.query);
    const wanted = new Set(ids);
    const found =
      wanted.size === 0
        ? []
        : (await catalog.posts())
            .flatMap((feed) => feed.items)
            .filter((item) => wanted.has(item.id));
    res.json({ data: found });
  });

  router.get('/items/:code', async (req, res) => {
    const raw = req.params.code.slice(0, 20);
    const wanted = normalizeItemCode(raw) ?? raw.trim().toUpperCase();
    for (const feed of await catalog.posts()) {
      const item = feed.items.find((entry) => entry.code === wanted);
      if (item) {
        res.json({ data: { item, feed } });
        return;
      }
    }
    throw notFound('Không tìm thấy con Bakugan này. Có thể feed chứa nó đã được shop gỡ khỏi web.');
  });

  router.get('/suggestions', async (req, res) => {
    const query = parseInput(suggestionSchema, req.query);
    const needle = normalizeSearch(query.keyword);
    if (needle.length < 2) {
      res.json({ data: { items: [], feeds: [] } });
      return;
    }
    const posts = await catalog.posts();
    const items = posts
      .flatMap((feed) => feed.items)
      .filter((item) => itemHaystack(item).includes(needle))
      // Con còn bán lên trước
      .sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold'))
      .slice(0, query.limit);
    const feeds = posts.filter((feed) => feedHaystack(feed).includes(needle)).slice(0, 3);
    res.json({ data: { items, feeds } });
  });

  router.get('/:number', async (req, res) => {
    const number = /^\d{1,9}$/.test(req.params.number) ? Number(req.params.number) : NaN;
    const feed = (await catalog.posts()).find((entry) => entry.number === number);
    if (!feed) {
      throw notFound('Không tìm thấy feed này. Có thể feed đã bán hết và được shop gỡ khỏi web.');
    }
    res.json({ data: feed });
  });

  return router;
}

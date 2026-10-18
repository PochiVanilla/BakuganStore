import { Router } from 'express';
import { z } from 'zod';
import { parseInput } from '../../lib/errors';
import { requireAdmin } from '../../middleware/auth';
import { FEED_LIMIT, type FeedStatusFilter } from '../../shared/types';
import {
  adminItemQuerySchema,
  countLeftovers,
  listAdminItems,
  listLeftoverItems,
  listSellableItems,
} from './itemList';
import {
  adminFeedsOf,
  createFeed,
  deleteFeed,
  deleteItem,
  feedLimitCheck,
  getAdminFeed,
  markItemAvailable,
  markItemSold,
  suggestItemCodes,
  updateFeed,
  updateItem,
  type CatalogDeps,
} from './service';
import { activeFeeds } from './store';
import {
  cleanFeedInput,
  cleanItemInput,
  createFeedSchema,
  feedInputSchema,
  itemInputSchema,
} from './validation';

const nextCodesSchema = z.object({ count: z.coerce.number().int().min(1).max(60).default(10) });
const sellableSchema = z.object({ keyword: z.string().max(100).default('') });
const markSoldSchema = z.object({
  buyerName: z.string().max(100, 'Tên người mua tối đa 100 ký tự.').optional(),
  note: z.string().max(255, 'Ghi chú tối đa 255 ký tự.').optional(),
});

/** /api/admin/feeds — quản lý feed bán hàng (chỉ admin). */
export function adminFeedsRouter(deps: CatalogDeps): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/', async (_req, res) => {
    const feeds = await adminFeedsOf(deps.db, await activeFeeds(deps.db));
    const counts: Record<FeedStatusFilter, number> = {
      all: feeds.length,
      selling: 0,
      upcoming: 0,
      'sold-out': 0,
    };
    for (const feed of feeds) counts[feed.status] += 1;
    res.json({
      data: { feeds, counts, limit: FEED_LIMIT, leftoverCount: await countLeftovers(deps.db) },
    });
  });

  router.get('/limit', async (_req, res) => {
    res.json({ data: await feedLimitCheck(deps.db) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ data: await getAdminFeed(deps.db, req.params.id) });
  });

  router.post('/', async (req, res) => {
    const body = parseInput(createFeedSchema, req.body);
    const input = cleanFeedInput(body, Boolean(body.carryLeftovers));
    const feed = await createFeed(deps, req, input, {
      replaceFeedId: body.replaceFeedId,
      carryLeftovers: body.carryLeftovers,
    });
    res.status(201).json({ data: feed });
  });

  router.put('/:id', async (req, res) => {
    const input = cleanFeedInput(parseInput(feedInputSchema, req.body), true);
    res.json({ data: await updateFeed(deps, req, req.params.id, input) });
  });

  router.delete('/:id', async (req, res) => {
    res.json({ data: await deleteFeed(deps, req, req.params.id) });
  });

  return router;
}

/** /api/admin/items — từng con Bakugan: kho, hàng tồn, bán ngoài web (chỉ admin). */
export function adminItemsRouter(deps: CatalogDeps): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/', async (req, res) => {
    res.json({ data: await listAdminItems(deps.db, parseInput(adminItemQuerySchema, req.query)) });
  });

  router.get('/leftovers', async (_req, res) => {
    res.json({ data: await listLeftoverItems(deps.db) });
  });

  router.get('/next-codes', async (req, res) => {
    const { count } = parseInput(nextCodesSchema, req.query);
    res.json({ data: await suggestItemCodes(deps.db, count) });
  });

  router.get('/sellable', async (req, res) => {
    const { keyword } = parseInput(sellableSchema, req.query);
    res.json({ data: await listSellableItems(deps.db, keyword) });
  });

  router.put('/:id', async (req, res) => {
    const input = cleanItemInput(parseInput(itemInputSchema, req.body));
    res.json({ data: await updateItem(deps, req, req.params.id, input) });
  });

  router.post('/:id/mark-sold', async (req, res) => {
    const input = parseInput(markSoldSchema, req.body ?? {});
    res.json({ data: await markItemSold(deps, req, req.params.id, input) });
  });

  router.post('/:id/mark-available', async (req, res) => {
    res.json({ data: await markItemAvailable(deps, req, req.params.id) });
  });

  router.delete('/:id', async (req, res) => {
    await deleteItem(deps, req, req.params.id);
    res.json({ data: { ok: true } });
  });

  return router;
}

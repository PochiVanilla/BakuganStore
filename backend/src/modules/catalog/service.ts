import { and, asc, count, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { Request } from 'express';
import type { Db } from '../../db/client';
import { COUNTERS, lockCounter, nextCounter } from '../../db/counters';
import { counters, feeds, items, orderItems } from '../../db/schema';
import { mysqlErrno, withTransaction, type Tx } from '../../db/tx';
import { writeAudit } from '../../lib/audit';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { attributeKeyOf, formatItemCode, normalizeSearch } from '../../shared/catalog';
import { FEED_LIMIT, type AdminFeed, type FeedLimitCheck } from '../../shared/types';
import { claimMedia, releaseMedia } from '../uploads/media';
import { toAdminFeed, toAdminItem, type FeedRow, type ItemRow } from './dto';
import { activeFeeds, groupByFeed, loadAdminItems, type FeedCatalog } from './store';
import type { CleanFeed, CleanItem } from './validation';

/*
 * Nghiệp vụ admin với feed và từng con, chạy trên MySQL — làm đúng như bản giả lập
 * (src/services/api/admin/feeds.ts) nhưng trong transaction có khoá dòng:
 * - Số feed và mã BK lấy từ bảng `counters` (khoá dòng → hai admin cùng bấm cũng không trùng).
 * - Khoá dòng "số feed" cũng xếp hàng các lần đăng feed, nên không bao giờ vượt 30 feed.
 * - Ảnh / video bị thay hoặc bỏ được dọn khỏi ổ SAU KHI lưu xong.
 */

export interface CatalogDeps {
  db: Db;
  catalog: FeedCatalog;
  uploadDir: string;
  logger: Logger;
}

export const FEED_NOT_FOUND = 'Không tìm thấy feed này (có thể đã bị xoá).';
export const ITEM_NOT_FOUND = 'Không tìm thấy con Bakugan này.';

/* ---------------- Đọc ---------------- */

/** Feed đang có kèm các con (bản admin: có người mua, đơn, doanh thu, giá nhập). */
export async function adminFeedsOf(executor: Db | Tx, feedRows: FeedRow[]): Promise<AdminFeed[]> {
  if (feedRows.length === 0) return [];
  const loaded = await loadAdminItems(executor, {
    where: inArray(
      items.feedId,
      feedRows.map((feed) => feed.id),
    ),
  });
  const grouped = groupByFeed(loaded.map((row) => row.item));
  const now = Date.now();
  return feedRows.map((feed) => toAdminFeed(feed, grouped.get(feed.id) ?? [], now));
}

export async function getAdminFeed(db: Db, feedId: string): Promise<AdminFeed> {
  const [feed] = await db
    .select()
    .from(feeds)
    .where(and(eq(feeds.id, feedId), isNull(feeds.retiredAt)))
    .limit(1);
  if (!feed) throw notFound(FEED_NOT_FOUND);
  const [adminFeed] = await adminFeedsOf(db, [feed]);
  return adminFeed!;
}

export async function getAdminItem(executor: Db | Tx, itemId: string) {
  const [loaded] = await loadAdminItems(executor, { where: eq(items.id, itemId) });
  if (!loaded) throw notFound(ITEM_NOT_FOUND);
  return toAdminItem(loaded.item, loaded.feed, Date.now());
}

/** Web đã đủ 30 feed chưa; đủ thì feed cũ nhất (sẽ bị xoá) và những con chưa bán trong đó. */
export async function feedLimitCheck(executor: Db | Tx): Promise<FeedLimitCheck> {
  const active = await activeFeeds(executor);
  const check: FeedLimitCheck = { feedCount: active.length, limit: FEED_LIMIT };
  const oldest = active.at(-1);
  if (active.length >= FEED_LIMIT && oldest) {
    const rows = await executor
      .select()
      .from(items)
      .where(eq(items.feedId, oldest.id))
      .orderBy(asc(items.position), asc(items.code));
    check.oldest = {
      id: oldest.id,
      number: oldest.number,
      title: oldest.title,
      publishedAt: oldest.publishedAt.toISOString(),
      itemCount: rows.length,
      soldCount: rows.filter((item) => item.status === 'sold').length,
      leftovers: rows
        .filter((item) => item.status === 'available')
        .map(({ id, code, name, price }) => ({ id, code, name, price })),
    };
  }
  return check;
}

/** Vài mã kế tiếp để hiện gợi ý trong form (mã thật do server cấp khi lưu). */
export async function suggestItemCodes(db: Db, wanted: number): Promise<string[]> {
  const [counter] = await db
    .select({ value: counters.value })
    .from(counters)
    .where(eq(counters.name, COUNTERS.itemCode));
  let sequence = (counter?.value ?? 0) + 1;
  const codes: string[] = [];
  while (codes.length < wanted) {
    const batch = Array.from({ length: wanted * 2 }, (_, index) =>
      formatItemCode(sequence + index),
    );
    const taken = new Set(
      (await db.select({ code: items.code }).from(items).where(inArray(items.code, batch))).map(
        (row) => row.code,
      ),
    );
    codes.push(...batch.filter((code) => !taken.has(code)).slice(0, wanted - codes.length));
    sequence += batch.length;
  }
  return codes;
}

/* ---------------- Mã Bakugan ---------------- */

function searchTextOf(name: string, code: string): string {
  return normalizeSearch(`${name} ${code} ${code.replace('-', '')}`);
}

async function codeTaken(tx: Tx, code: string, exceptId?: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: items.id })
    .from(items)
    .where(exceptId ? and(eq(items.code, code), ne(items.id, exceptId)) : eq(items.code, code))
    .limit(1);
  return Boolean(row);
}

/**
 * Cấp mã cho một con. Admin tự gõ: trùng con khác (kể cả đã bán) → 409.
 * Bỏ trống: lấy số kế tiếp từ bộ đếm, bỏ qua những mã admin đã gõ tay.
 * `reserved`: mã đã cấp trong cùng lần lưu (chưa ghi xuống CSDL).
 */
async function assignCode(
  tx: Tx,
  wanted: string | undefined,
  reserved: Set<string>,
  exceptId?: string,
): Promise<string> {
  if (wanted) {
    if (reserved.has(wanted) || (await codeTaken(tx, wanted, exceptId))) {
      throw conflict(`Mã ${wanted} đã có con khác dùng. Đổi mã khác nhé.`);
    }
    reserved.add(wanted);
    return wanted;
  }
  for (;;) {
    const code = formatItemCode(await nextCounter(tx, COUNTERS.itemCode));
    if (!reserved.has(code) && !(await codeTaken(tx, code))) {
      reserved.add(code);
      return code;
    }
  }
}

/** UNIQUE trên mã là chốt chặn cuối: hai lần lưu chen nhau cùng gõ một mã → 409 thay vì lỗi 500. */
async function guardDuplicateCode<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    // 1062 = trùng khoá UNIQUE; ở đây chỉ có thể là mã Bakugan (số feed đã khoá bộ đếm).
    if (mysqlErrno(error) === 1062) {
      throw conflict('Mã Bakugan vừa bị trùng với một con khác. Thử lưu lại nhé.');
    }
    throw error;
  }
}

/* ---------------- Ghi từng con ---------------- */

function mediaOf(item: Pick<ItemRow, 'photos' | 'video'>): string[] {
  return [...item.photos, ...(item.video ? [item.video] : [])];
}

/** Các cột lấy từ form; con đã bán giữ nguyên giá (lịch sử đơn). */
function itemColumns(input: Omit<CleanItem, 'id' | 'code'>, code: string, keepPrice: boolean) {
  return {
    code,
    name: input.name,
    ...(keepPrice ? {} : { price: input.price }),
    attribute: input.attribute,
    attributeKey: attributeKeyOf(input.attribute) ?? null,
    series: input.series,
    condition: input.condition,
    photos: input.photos,
    video: input.video,
    searchText: searchTextOf(input.name, code),
  };
}

/** Ảnh / video của con này trước khi sửa mà sau khi sửa không còn. */
function droppedMedia(before: Pick<ItemRow, 'photos' | 'video'>, after: Omit<CleanItem, 'id'>) {
  const kept = new Set([...after.photos, ...(after.video ? [after.video] : [])]);
  return mediaOf(before).filter((url) => !kept.has(url));
}

/**
 * Đặt danh sách con vào feed theo đúng thứ tự trong form.
 * - Con đã có: phải tồn tại, không nằm trong feed khác; con đã bán giữ nguyên giá.
 * - Con mới: cấp mã.
 * - Con bị bỏ khỏi form: chưa bán thì thành hàng tồn (ghi lại tên / số feed), đã bán thì ở lại cuối feed.
 * Trả về URL ảnh / video đã bị thay hoặc bỏ.
 */
async function placeItems(tx: Tx, feed: FeedRow, inputs: readonly CleanItem[]): Promise<string[]> {
  const wantedIds = inputs.flatMap((input) => (input.id ? [input.id] : []));
  const current = await tx.select().from(items).where(eq(items.feedId, feed.id)).for('update');
  const picked =
    wantedIds.length > 0
      ? await tx.select().from(items).where(inArray(items.id, wantedIds)).for('update')
      : [];
  const byId = new Map([...current, ...picked].map((item) => [item.id, item]));
  const reserved = new Set<string>();
  const keptIds = new Set<string>();
  const removedMedia: string[] = [];

  for (const [index, input] of inputs.entries()) {
    const position = index + 1;
    if (input.id) {
      const item = byId.get(input.id);
      if (!item) throw conflict('Có con Bakugan không còn tồn tại, tải lại trang nhé.');
      if (item.feedId && item.feedId !== feed.id) {
        throw conflict(`${item.code} đang nằm trong feed khác.`);
      }
      if (!item.feedId && item.status === 'sold') throw conflict(`${item.code} đã bán rồi.`);
      const code =
        input.code && input.code !== item.code
          ? await assignCode(tx, input.code, reserved, item.id)
          : item.code;
      removedMedia.push(...droppedMedia(item, input));
      await tx
        .update(items)
        .set({
          ...itemColumns(input, code, item.status === 'sold'),
          feedId: feed.id,
          position,
        })
        .where(eq(items.id, item.id));
      keptIds.add(item.id);
      continue;
    }
    const code = await assignCode(tx, input.code, reserved);
    const id = newId();
    await tx.insert(items).values({
      id,
      ...itemColumns(input, code, false),
      price: input.price,
      status: 'available',
      feedId: feed.id,
      position,
    });
    keptIds.add(id);
  }

  // Con bị bỏ khỏi feed
  let tail = inputs.length;
  for (const item of current) {
    if (keptIds.has(item.id)) continue;
    if (item.status === 'sold') {
      tail += 1;
      await tx.update(items).set({ position: tail }).where(eq(items.id, item.id));
    } else {
      await tx
        .update(items)
        .set({ feedId: null, feedTitleSnapshot: feed.title, feedNumberSnapshot: feed.number })
        .where(eq(items.id, item.id));
    }
  }
  return removedMedia;
}

/**
 * Gỡ feed khỏi web: con chưa bán thành hàng tồn, con đã bán giữ lịch sử (tên + số feed).
 * Trả về id những con thành hàng tồn và ảnh của feed (để dọn khỏi ổ).
 */
async function retireFeed(
  tx: Tx,
  feed: FeedRow,
): Promise<{ leftovers: string[]; images: string[] }> {
  const rows = await tx
    .select({ id: items.id, status: items.status })
    .from(items)
    .where(eq(items.feedId, feed.id))
    .for('update');
  await tx
    .update(items)
    .set({ feedId: null, feedTitleSnapshot: feed.title, feedNumberSnapshot: feed.number })
    .where(eq(items.feedId, feed.id));
  await tx.update(feeds).set({ retiredAt: new Date(), images: [] }).where(eq(feeds.id, feed.id));
  return {
    leftovers: rows.filter((row) => row.status === 'available').map((row) => row.id),
    images: feed.images,
  };
}

function allMedia(feed: Pick<CleanFeed, 'images'>, inputs: readonly CleanItem[]) {
  return {
    images: [...feed.images, ...inputs.flatMap((item) => item.photos)],
    videos: inputs.flatMap((item) => (item.video ? [item.video] : [])),
  };
}

/** Sau khi lưu xong: dọn ảnh / video không còn dùng và xoá bộ đệm danh sách feed của khách. */
async function afterSave(deps: CatalogDeps, removed: string[]): Promise<void> {
  deps.catalog.invalidate();
  await releaseMedia(deps.db, deps.uploadDir, removed, deps.logger);
}

/* ---------------- Feed: tạo / sửa / xoá ---------------- */

export async function createFeed(
  deps: CatalogDeps,
  req: Request,
  input: CleanFeed,
  options: { replaceFeedId?: string | null; carryLeftovers?: boolean | null },
): Promise<AdminFeed> {
  const { feedId, removed } = await guardDuplicateCode(() =>
    withTransaction(deps.db, async (tx) => {
      // Khoá bộ đếm số feed trước tiên: các lần đăng feed xếp hàng lần lượt.
      await lockCounter(tx, COUNTERS.feedNumber);
      const removed: string[] = [];

      const check = await feedLimitCheck(tx);
      let carried: string[] = [];
      if (check.oldest) {
        if (options.replaceFeedId !== check.oldest.id) {
          throw conflict(
            `Web đã có ${check.feedCount}/${check.limit} feed. Cần xác nhận xoá feed cũ nhất trước khi đăng feed mới.`,
          );
        }
        const [oldest] = await tx
          .select()
          .from(feeds)
          .where(eq(feeds.id, check.oldest.id))
          .for('update');
        const retired = await retireFeed(tx, oldest!);
        removed.push(...retired.images);
        if (options.carryLeftovers) carried = retired.leftovers;
      }

      const now = new Date();
      const feed: FeedRow = {
        id: newId(),
        number: await nextCounter(tx, COUNTERS.feedNumber),
        title: input.title,
        caption: input.caption,
        images: input.images,
        publishedAt: now,
        opensAt: input.opensAt ?? now,
        lotCost: input.lotCost,
        supplier: input.supplier,
        createdBy: req.auth?.user.id ?? null,
        retiredAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(feeds).values(feed);

      // Con mang sang từ feed bị xoá đứng sau những con admin nhập.
      const typed = new Set(input.items.flatMap((item) => (item.id ? [item.id] : [])));
      const carriedRows = carried.filter((id) => !typed.has(id));
      const carriedInputs: CleanItem[] =
        carriedRows.length > 0
          ? (
              await tx
                .select()
                .from(items)
                .where(inArray(items.id, carriedRows))
                .orderBy(asc(items.position), asc(items.code))
            ).map((item) => ({
              id: item.id,
              name: item.name,
              code: item.code,
              price: item.price,
              attribute: item.attribute,
              series: item.series,
              condition: item.condition,
              photos: item.photos,
              video: item.video,
            }))
          : [];
      const inputs = [...input.items, ...carriedInputs];
      if (inputs.length === 0) throw unprocessable('Feed cần ít nhất một con Bakugan.');
      await claimMedia(tx, allMedia(input, inputs));
      removed.push(...(await placeItems(tx, feed, inputs)));

      await writeAudit(tx, req, {
        action: 'feed.create',
        targetType: 'feed',
        targetId: feed.id,
        detail: {
          number: feed.number,
          title: feed.title,
          itemCount: inputs.length,
          ...(check.oldest ? { replacedFeed: check.oldest.number } : {}),
        },
      });
      return { feedId: feed.id, removed };
    }),
  );
  await afterSave(deps, removed);
  return getAdminFeed(deps.db, feedId);
}

export async function updateFeed(
  deps: CatalogDeps,
  req: Request,
  feedId: string,
  input: CleanFeed,
): Promise<AdminFeed> {
  const removed = await guardDuplicateCode(() =>
    withTransaction(deps.db, async (tx) => {
      const [current] = await tx
        .select()
        .from(feeds)
        .where(and(eq(feeds.id, feedId), isNull(feeds.retiredAt)))
        .for('update');
      if (!current) throw notFound(FEED_NOT_FOUND);
      await claimMedia(tx, allMedia(input, input.items));
      const removed = current.images.filter((url) => !input.images.includes(url));

      const feed: FeedRow = {
        ...current,
        title: input.title,
        caption: input.caption,
        images: input.images,
        opensAt: input.opensAt ?? current.opensAt,
        lotCost: input.lotCost,
        supplier: input.supplier,
      };
      await tx
        .update(feeds)
        .set({
          title: feed.title,
          caption: feed.caption,
          images: feed.images,
          opensAt: feed.opensAt,
          lotCost: feed.lotCost,
          supplier: feed.supplier,
        })
        .where(eq(feeds.id, feedId));
      removed.push(...(await placeItems(tx, feed, input.items)));

      const [{ total } = { total: 0 }] = await tx
        .select({ total: count() })
        .from(items)
        .where(eq(items.feedId, feedId));
      if (total === 0) throw unprocessable('Feed cần ít nhất một con Bakugan.');
      // Đổi tên feed thì những con đã bán trong feed cũng mang tên mới.
      await tx
        .update(items)
        .set({ feedTitleSnapshot: feed.title })
        .where(and(eq(items.feedId, feedId), eq(items.status, 'sold')));

      await writeAudit(tx, req, {
        action: 'feed.update',
        targetType: 'feed',
        targetId: feedId,
        detail: { number: feed.number, title: feed.title, itemCount: input.items.length },
      });
      return removed;
    }),
  );
  await afterSave(deps, removed);
  return getAdminFeed(deps.db, feedId);
}

/** Xoá feed khỏi web. Con chưa bán chuyển vào hàng tồn để đăng lại sau. */
export async function deleteFeed(
  deps: CatalogDeps,
  req: Request,
  feedId: string,
): Promise<{ leftoverCount: number }> {
  const retired = await withTransaction(deps.db, async (tx) => {
    const [feed] = await tx
      .select()
      .from(feeds)
      .where(and(eq(feeds.id, feedId), isNull(feeds.retiredAt)))
      .for('update');
    if (!feed) throw notFound(FEED_NOT_FOUND);
    const result = await retireFeed(tx, feed);
    await writeAudit(tx, req, {
      action: 'feed.delete',
      targetType: 'feed',
      targetId: feedId,
      detail: { number: feed.number, title: feed.title, leftoverCount: result.leftovers.length },
    });
    return result;
  });
  await afterSave(deps, retired.images);
  return { leftoverCount: retired.leftovers.length };
}

/* ---------------- Từng con ---------------- */

async function lockItem(tx: Tx, itemId: string): Promise<ItemRow> {
  const [item] = await tx.select().from(items).where(eq(items.id, itemId)).for('update');
  if (!item) throw notFound(ITEM_NOT_FOUND);
  return item;
}

/** Sửa thông tin một con (tên, mã, giá, tình trạng, ảnh, video…). Con đã bán không đổi giá. */
export async function updateItem(
  deps: CatalogDeps,
  req: Request,
  itemId: string,
  input: Omit<CleanItem, 'id'>,
) {
  const removed = await guardDuplicateCode(() =>
    withTransaction(deps.db, async (tx) => {
      const item = await lockItem(tx, itemId);
      let code = item.code;
      if (input.code && input.code !== item.code) {
        if (await codeTaken(tx, input.code, item.id)) {
          throw conflict(`Mã ${input.code} đã có con khác dùng.`, {
            code: 'Mã này đã có con khác dùng.',
          });
        }
        code = input.code;
      }
      await claimMedia(tx, {
        images: input.photos,
        videos: input.video ? [input.video] : [],
      });
      await tx
        .update(items)
        .set(itemColumns(input, code, item.status === 'sold'))
        .where(eq(items.id, itemId));
      await writeAudit(tx, req, {
        action: 'item.update',
        targetType: 'item',
        targetId: itemId,
        detail: { code, name: input.name },
      });
      return droppedMedia(item, input);
    }),
  );
  await afterSave(deps, removed);
  return getAdminItem(deps.db, itemId);
}

/** Bán ngoài web (chốt qua Messenger, livestream, bán tại shop) — admin tự đánh dấu SOLD. */
export async function markItemSold(
  deps: CatalogDeps,
  req: Request,
  itemId: string,
  input: { buyerName?: string; note?: string },
) {
  await withTransaction(deps.db, async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status === 'sold') throw conflict(`${item.code} đã bán rồi.`);
    const [feed] = item.feedId
      ? await tx.select().from(feeds).where(eq(feeds.id, item.feedId)).limit(1)
      : [];
    await tx
      .update(items)
      .set({
        status: 'sold',
        soldVia: 'manual',
        soldAt: new Date(),
        buyerName: input.buyerName?.trim() || null,
        soldNote: input.note?.trim() || 'Bán ngoài web',
        ...(feed ? { feedTitleSnapshot: feed.title, feedNumberSnapshot: feed.number } : {}),
      })
      .where(eq(items.id, itemId));
    await writeAudit(tx, req, {
      action: 'item.mark-sold',
      targetType: 'item',
      targetId: itemId,
      detail: { code: item.code },
    });
  });
  deps.catalog.invalidate();
  return getAdminItem(deps.db, itemId);
}

/** Bỏ đánh dấu SOLD (chỉ với con admin tự đánh dấu; con bán qua đơn thì huỷ đơn). */
export async function markItemAvailable(deps: CatalogDeps, req: Request, itemId: string) {
  await withTransaction(deps.db, async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status !== 'sold') throw conflict(`${item.code} đang còn bán.`);
    if (item.soldVia === 'order' || item.orderId) {
      throw conflict(
        `${item.code} được bán qua một đơn hàng — huỷ đơn đó thì con này tự quay lại bán.`,
      );
    }
    await tx
      .update(items)
      .set({ status: 'available', soldAt: null, soldVia: null, soldNote: null, buyerName: null })
      .where(eq(items.id, itemId));
    await writeAudit(tx, req, {
      action: 'item.mark-available',
      targetType: 'item',
      targetId: itemId,
      detail: { code: item.code },
    });
  });
  deps.catalog.invalidate();
  return getAdminItem(deps.db, itemId);
}

/** Xoá hẳn một con (VD: hư hỏng không bán được). Chỉ với con chưa bán và chưa từng nằm trong đơn nào. */
export async function deleteItem(deps: CatalogDeps, req: Request, itemId: string): Promise<void> {
  const removed = await withTransaction(deps.db, async (tx) => {
    const item = await lockItem(tx, itemId);
    if (item.status === 'sold') throw conflict('Không xoá được con đã bán.');
    const [inOrder] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.itemId, itemId))
      .limit(1);
    if (inOrder) {
      throw conflict(
        `${item.code} có trong lịch sử đơn hàng nên không xoá được — hãy đánh dấu đã bán hoặc để ở hàng tồn.`,
      );
    }
    await tx.delete(items).where(eq(items.id, itemId));
    await writeAudit(tx, req, {
      action: 'item.delete',
      targetType: 'item',
      targetId: itemId,
      detail: { code: item.code, name: item.name },
    });
    return mediaOf(item);
  });
  await afterSave(deps, removed);
}

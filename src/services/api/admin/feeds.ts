import type {
  AdminFeed,
  AdminItem,
  ApiResponse,
  BakuganSeries,
  FeedLimitCheck,
  FeedStatusFilter,
} from '@/types';
import { BAKUGAN_SERIES, FEED_LIMIT, ITEM_PHOTO_LIMIT } from '@/types';
import {
  createId,
  itemMediaRefs,
  itemsOfFeed,
  readDb,
  toFeedPost,
  toPublicItem,
  updateDb,
  type MockDatabase,
  type StoredFeed,
  type StoredItem,
} from '@/mocks/db';
import { formatItemCode, normalizeItemCode } from '@/utils/itemCode';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { deleteImageRefs } from '../imageStore';

/* ============================================================
   Quản lý feed bán hàng.

   - Mỗi feed: ảnh chụp cả lô + danh sách từng con Bakugan, mỗi con
     một tên (admin đặt) và một mã duy nhất (BK-0231).
   - Web giữ tối đa 30 feed. Đăng feed thứ 31 thì admin phải xác nhận
     xoá feed cũ nhất; con nào trong đó chưa bán thành "hàng tồn" để
     đưa vào feed mới.
   ============================================================ */

/* ---------------- Chuyển đổi dữ liệu ---------------- */

export function toAdminItem(db: Readonly<MockDatabase>, item: StoredItem): AdminItem {
  const feed = item.feedId ? db.feeds.find((entry) => entry.id === item.feedId) : undefined;
  const order = item.orderId ? db.orders.find((entry) => entry.id === item.orderId) : undefined;
  return {
    ...toPublicItem(item, feed),
    soldVia: item.status === 'sold' ? item.soldVia : undefined,
    orderId: item.orderId,
    orderCode: order?.code,
    buyerName: order?.receiverName ?? item.buyerName,
    soldNote: item.soldNote,
  };
}

export function toAdminFeed(
  db: Readonly<MockDatabase>,
  feed: StoredFeed,
  now: number = Date.now(),
): AdminFeed {
  const items = itemsOfFeed(db, feed.id);
  const post = toFeedPost(feed, items, now);
  return {
    ...post,
    items: items.map((item) => toAdminItem(db, item)),
    revenue: items
      .filter((item) => item.status === 'sold')
      .reduce((sum, item) => sum + item.price, 0),
    lotCost: feed.lotCost,
    supplier: feed.supplier,
  };
}

/* ---------------- Danh sách ---------------- */

export interface AdminFeedList {
  feeds: AdminFeed[];
  counts: Record<FeedStatusFilter, number>;
  limit: number;
  /** Số con chưa bán nằm ngoài mọi feed (từ feed đã xoá) */
  leftoverCount: number;
}

export async function listAdminFeeds(): Promise<AdminFeedList> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminFeedList>>('/admin/feeds');
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const now = Date.now();
  const feeds = [...db.feeds]
    .sort((a, b) => b.number - a.number)
    .map((feed) => toAdminFeed(db, feed, now));
  const counts: Record<FeedStatusFilter, number> = {
    all: feeds.length,
    selling: 0,
    upcoming: 0,
    'sold-out': 0,
  };
  feeds.forEach((feed) => {
    counts[feed.status] += 1;
  });
  return mockDelay(
    {
      feeds,
      counts,
      limit: FEED_LIMIT,
      leftoverCount: db.items.filter((item) => !item.feedId && item.status === 'available').length,
    },
    240,
  );
}

export async function getAdminFeed(feedId: string): Promise<AdminFeed> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminFeed>>(`/admin/feeds/${feedId}`);
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const feed = db.feeds.find((item) => item.id === feedId);
  if (!feed) throw new MockApiError('Không tìm thấy feed này (có thể đã bị xoá).', 404);
  return mockDelay(toAdminFeed(db, feed), 200);
}

function oldestFeed(db: Readonly<MockDatabase>): StoredFeed | undefined {
  return [...db.feeds].sort((a, b) => a.number - b.number)[0];
}

function limitCheckOf(db: Readonly<MockDatabase>): FeedLimitCheck {
  const check: FeedLimitCheck = { feedCount: db.feeds.length, limit: FEED_LIMIT };
  const oldest = oldestFeed(db);
  if (db.feeds.length >= FEED_LIMIT && oldest) {
    const items = itemsOfFeed(db, oldest.id);
    check.oldest = {
      id: oldest.id,
      number: oldest.number,
      title: oldest.title,
      publishedAt: oldest.publishedAt,
      itemCount: items.length,
      soldCount: items.filter((item) => item.status === 'sold').length,
      leftovers: items
        .filter((item) => item.status === 'available')
        .map(({ id, code, name, price }) => ({ id, code, name, price })),
    };
  }
  return check;
}

/** Trước khi đăng: web đã đủ 30 feed chưa, nếu đủ thì feed nào sẽ bị xoá. */
export async function checkFeedLimit(): Promise<FeedLimitCheck> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<FeedLimitCheck>>('/admin/feeds/limit');
    return data.data;
  }
  requireAdmin();
  return mockDelay(limitCheckOf(readDb()), 120);
}

/** Hàng tồn: con chưa bán không thuộc feed nào — để đưa vào feed mới. */
export async function listLeftoverItems(): Promise<AdminItem[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminItem[]>>('/admin/items/leftovers');
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  return mockDelay(
    db.items
      .filter((item) => !item.feedId && item.status === 'available')
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((item) => toAdminItem(db, item)),
    160,
  );
}

/** Vài mã kế tiếp để hiện gợi ý trong form (mã thật do server cấp khi lưu). */
export async function suggestItemCodes(count: number): Promise<string[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<string[]>>('/admin/items/next-codes', {
      params: { count },
    });
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const taken = new Set(db.items.map((item) => item.code));
  const codes: string[] = [];
  let sequence = db.nextItemNumber;
  while (codes.length < count) {
    const code = formatItemCode(sequence);
    if (!taken.has(code)) codes.push(code);
    sequence += 1;
  }
  return mockDelay(codes, 60);
}

/* ---------------- Tạo / sửa / xoá ---------------- */

export interface FeedItemInput {
  /** Có id: con đã có (trong feed này hoặc lấy từ hàng tồn). Không có: con mới. */
  id?: string;
  name: string;
  /** Bỏ trống để hệ thống tự cấp mã kế tiếp */
  code?: string;
  price: number;
  /** Hệ shop tự gõ (VD "Pyrus") */
  attribute: string;
  series?: BakuganSeries;
  /** Tình trạng shop tự gõ (VD "Like new, trầy nhẹ"); bỏ trống nếu chưa ghi */
  condition?: string;
  /** Tối đa 3 ảnh riêng (mã tham chiếu từ uploadImage), ảnh đầu là ảnh chính */
  photos?: string[];
  /** Video giới thiệu (mã tham chiếu từ uploadVideo) */
  video?: string;
}

export interface FeedInput {
  title: string;
  caption: string;
  /** Mã tham chiếu ảnh (uploadImage) — ảnh đầu tiên là ảnh bìa */
  images: string[];
  /** Giờ mở bán, ISO; bỏ trống = mở bán ngay */
  opensAt?: string;
  lotCost?: number;
  supplier?: string;
  items: FeedItemInput[];
}

export interface CreateFeedOptions {
  /** Feed cũ nhất admin đã đồng ý xoá khi web đủ 30 feed */
  replaceFeedId?: string;
  /** Đưa luôn những con chưa bán của feed bị xoá vào feed mới */
  carryLeftovers?: boolean;
}

/** Giới hạn độ dài chữ shop tự gõ */
export const ATTRIBUTE_MAX = 40;
export const CONDITION_MAX = 160;

function fail(message: string, field?: string): never {
  throw new MockApiError(message, 422, field ? { [field]: message } : undefined);
}

function validateFeedInput(input: FeedInput, allowEmptyItems: boolean): void {
  if (input.title.trim().length < 3) fail('Tiêu đề feed cần ít nhất 3 ký tự.', 'title');
  if (input.images.length > 6) fail('Mỗi feed tối đa 6 ảnh.', 'images');
  if (!allowEmptyItems && input.items.length === 0) {
    fail('Feed cần ít nhất một con Bakugan.', 'items');
  }
  if (input.items.length > 60) fail('Mỗi feed tối đa 60 con.', 'items');
  if (input.opensAt && Number.isNaN(new Date(input.opensAt).getTime())) {
    fail('Giờ mở bán không hợp lệ.', 'opensAt');
  }
  if (input.lotCost !== undefined && (!Number.isFinite(input.lotCost) || input.lotCost < 0)) {
    fail('Giá nhập lô không hợp lệ.', 'lotCost');
  }
  input.items.forEach((item, index) => {
    const label = `Con thứ ${index + 1}`;
    if (item.name.trim().length < 2) fail(`${label}: chưa có tên.`);
    if (!Number.isInteger(item.price) || item.price <= 0) fail(`${label}: giá không hợp lệ.`);
    if (!item.attribute?.trim()) fail(`${label}: chưa ghi hệ.`);
    if (item.attribute.trim().length > ATTRIBUTE_MAX)
      fail(`${label}: hệ tối đa ${ATTRIBUTE_MAX} ký tự.`);
    if (item.series && !BAKUGAN_SERIES.includes(item.series)) fail(`${label}: dòng không hợp lệ.`);
    if ((item.condition?.trim().length ?? 0) > CONDITION_MAX) {
      fail(`${label}: tình trạng tối đa ${CONDITION_MAX} ký tự.`);
    }
    if (item.code?.trim() && !normalizeItemCode(item.code)) {
      fail(`${label}: mã "${item.code}" không đúng dạng BK-0123.`);
    }
    if ((item.photos?.length ?? 0) > ITEM_PHOTO_LIMIT) {
      fail(`${label}: tối đa ${ITEM_PHOTO_LIMIT} ảnh.`);
    }
  });
}

/** Cấp mã cho con mới, kiểm tra không trùng với mọi con đã có (kể cả đã bán). */
function assignCode(db: MockDatabase, wanted: string | undefined, reserved: Set<string>): string {
  const normalized = wanted?.trim() ? normalizeItemCode(wanted) : undefined;
  if (normalized) {
    if (reserved.has(normalized)) {
      throw new MockApiError(`Mã ${normalized} đã có con khác dùng. Đổi mã khác nhé.`, 409);
    }
    reserved.add(normalized);
    return normalized;
  }
  let code = formatItemCode(db.nextItemNumber);
  while (reserved.has(code)) {
    db.nextItemNumber += 1;
    code = formatItemCode(db.nextItemNumber);
  }
  db.nextItemNumber += 1;
  reserved.add(code);
  return code;
}

/**
 * Ghi thông tin trong form vào một con. Trả về mã ảnh / video cũ không còn dùng
 * để dọn khỏi kho sau khi lưu.
 */
export function applyItemFields(
  item: StoredItem,
  input: Omit<FeedItemInput, 'id' | 'code'>,
  allowPriceChange: boolean,
): string[] {
  const before = itemMediaRefs(item);
  item.name = input.name.trim();
  if (allowPriceChange) item.price = input.price;
  item.attribute = input.attribute.trim();
  item.series = input.series || undefined;
  item.condition = input.condition?.trim() || undefined;
  const photos = (input.photos ?? []).filter(Boolean).slice(0, ITEM_PHOTO_LIMIT);
  item.photos = photos.length > 0 ? photos : undefined;
  item.video = input.video || undefined;
  const kept = new Set(itemMediaRefs(item));
  return before.filter((ref) => !kept.has(ref));
}

/**
 * Đặt danh sách con vào feed theo đúng thứ tự trong form.
 * Con đã bán giữ nguyên giá (lịch sử đơn); con bị bỏ khỏi form mà chưa bán thì
 * thành hàng tồn, con đã bán thì vẫn ở lại feed.
 * Trả về mã ảnh / video của từng con đã bị thay hoặc bỏ.
 */
function placeItems(
  db: MockDatabase,
  feed: StoredFeed,
  inputs: FeedItemInput[],
  at: string,
): string[] {
  const reserved = new Set(db.items.map((item) => item.code));
  const keptIds = new Set<string>();
  const removedMedia: string[] = [];

  inputs.forEach((input, index) => {
    if (input.id) {
      const item = db.items.find((entry) => entry.id === input.id);
      if (!item)
        throw new MockApiError('Có con Bakugan không còn tồn tại, tải lại trang nhé.', 409);
      if (item.feedId && item.feedId !== feed.id) {
        throw new MockApiError(`${item.code} đang nằm trong feed khác.`, 409);
      }
      const wantedCode = input.code?.trim() ? normalizeItemCode(input.code) : undefined;
      if (wantedCode && wantedCode !== item.code) {
        reserved.delete(item.code);
        item.code = assignCode(db, wantedCode, reserved);
      }
      removedMedia.push(...applyItemFields(item, input, item.status !== 'sold'));
      item.feedId = feed.id;
      item.position = index + 1;
      keptIds.add(item.id);
      return;
    }
    const item: StoredItem = {
      id: createId('itm'),
      code: assignCode(db, input.code, reserved),
      name: '',
      price: input.price,
      attribute: input.attribute,
      condition: input.condition,
      status: 'available',
      feedId: feed.id,
      position: index + 1,
      createdAt: at,
    };
    applyItemFields(item, input, true);
    db.items.push(item);
    keptIds.add(item.id);
  });

  // Con bị bỏ khỏi feed
  let tail = inputs.length;
  db.items.forEach((item) => {
    if (item.feedId !== feed.id || keptIds.has(item.id)) return;
    if (item.status === 'sold') {
      tail += 1;
      item.position = tail;
      return;
    }
    item.feedTitle = feed.title;
    item.feedNumber = feed.number;
    item.feedId = undefined;
  });
  return removedMedia;
}

/** Gỡ feed khỏi web: con chưa bán thành hàng tồn, con đã bán giữ lại lịch sử. */
function retireFeed(db: MockDatabase, feed: StoredFeed): string[] {
  const leftovers: string[] = [];
  db.items.forEach((item) => {
    if (item.feedId !== feed.id) return;
    item.feedTitle = feed.title;
    item.feedNumber = feed.number;
    item.feedId = undefined;
    if (item.status === 'available') leftovers.push(item.id);
  });
  db.feeds = db.feeds.filter((entry) => entry.id !== feed.id);
  return leftovers;
}

export class FeedLimitError extends MockApiError {
  readonly check: FeedLimitCheck;

  constructor(check: FeedLimitCheck) {
    super(
      `Web đã có ${check.feedCount}/${check.limit} feed. Cần xác nhận xoá feed cũ nhất trước khi đăng feed mới.`,
      409,
    );
    this.check = check;
  }
}

export async function createFeed(
  input: FeedInput,
  options: CreateFeedOptions = {},
): Promise<AdminFeed> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<AdminFeed>>('/admin/feeds', {
      ...input,
      ...options,
    });
    return data.data;
  }
  const admin = requireAdmin();
  validateFeedInput(input, Boolean(options.carryLeftovers));

  const check = limitCheckOf(readDb());
  if (check.oldest && options.replaceFeedId !== check.oldest.id) {
    throw new FeedLimitError(check);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let removedImages: string[] = [];

  const created = updateDb((db) => {
    let carried: string[] = [];
    if (check.oldest) {
      const oldest = db.feeds.find((feed) => feed.id === check.oldest!.id);
      if (oldest) {
        removedImages = [...oldest.images];
        const leftovers = retireFeed(db, oldest);
        if (options.carryLeftovers) carried = leftovers;
      }
    }

    const feed: StoredFeed = {
      id: createId('feed'),
      number: db.nextFeedNumber,
      title: input.title.trim(),
      caption: input.caption.trim(),
      images: [...input.images],
      publishedAt: nowIso,
      opensAt: input.opensAt ? new Date(input.opensAt).toISOString() : nowIso,
      lotCost: input.lotCost || undefined,
      supplier: input.supplier?.trim() || undefined,
      createdBy: admin.fullName,
    };
    db.nextFeedNumber += 1;
    db.feeds.push(feed);

    // Con mang sang từ feed bị xoá đứng sau những con admin nhập.
    const carriedInputs: FeedItemInput[] = carried
      .filter((id) => !input.items.some((item) => item.id === id))
      .map((id) => {
        const item = db.items.find((entry) => entry.id === id)!;
        return {
          id,
          name: item.name,
          code: item.code,
          price: item.price,
          attribute: item.attribute,
          series: item.series,
          condition: item.condition,
          photos: item.photos,
          video: item.video,
        };
      });
    const inputs = [...input.items, ...carriedInputs];
    if (inputs.length === 0) throw new MockApiError('Feed cần ít nhất một con Bakugan.', 422);
    removedImages.push(...placeItems(db, feed, inputs, nowIso));
    return feed;
  });

  if (removedImages.length > 0) void deleteImageRefs(removedImages);
  return mockDelay(toAdminFeed(readDb(), created), 450);
}

export async function updateFeed(feedId: string, input: FeedInput): Promise<AdminFeed> {
  if (!USE_MOCK) {
    const { data } = await apiClient.put<ApiResponse<AdminFeed>>(`/admin/feeds/${feedId}`, input);
    return data.data;
  }
  requireAdmin();
  validateFeedInput(input, true);
  const nowIso = new Date().toISOString();
  let removedImages: string[] = [];

  const updated = updateDb((db) => {
    const feed = db.feeds.find((item) => item.id === feedId);
    if (!feed) throw new MockApiError('Không tìm thấy feed này (có thể đã bị xoá).', 404);
    removedImages = feed.images.filter((ref) => !input.images.includes(ref));
    feed.title = input.title.trim();
    feed.caption = input.caption.trim();
    feed.images = [...input.images];
    if (input.opensAt) feed.opensAt = new Date(input.opensAt).toISOString();
    feed.lotCost = input.lotCost || undefined;
    feed.supplier = input.supplier?.trim() || undefined;
    removedImages.push(...placeItems(db, feed, input.items, nowIso));
    if (!db.items.some((item) => item.feedId === feed.id)) {
      throw new MockApiError('Feed cần ít nhất một con Bakugan.', 422);
    }
    // Đổi tên feed thì những con đã bán trong feed cũng hiện tên mới.
    db.items.forEach((item) => {
      if (item.feedId === feed.id && item.status === 'sold') item.feedTitle = feed.title;
    });
    return feed;
  });

  if (removedImages.length > 0) void deleteImageRefs(removedImages);
  return mockDelay(toAdminFeed(readDb(), updated), 400);
}

/** Xoá feed khỏi web. Con chưa bán chuyển vào hàng tồn để đăng lại sau. */
export async function deleteFeed(feedId: string): Promise<{ leftoverCount: number }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.delete<ApiResponse<{ leftoverCount: number }>>(
      `/admin/feeds/${feedId}`,
    );
    return data.data;
  }
  requireAdmin();
  let images: string[] = [];
  const leftovers = updateDb((db) => {
    const feed = db.feeds.find((item) => item.id === feedId);
    if (!feed) throw new MockApiError('Không tìm thấy feed này (có thể đã bị xoá).', 404);
    images = feed.images;
    return retireFeed(db, feed);
  });
  void deleteImageRefs(images);
  return mockDelay({ leftoverCount: leftovers.length }, 350);
}

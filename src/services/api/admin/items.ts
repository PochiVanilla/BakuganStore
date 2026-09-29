import type { AdminItem, ApiResponse, BakuganAttribute, Paginated } from '@/types';
import { ITEM_PHOTO_LIMIT } from '@/types';
import { itemMediaRefs, readDb, updateDb } from '@/mocks/db';
import { attributeKeyOf } from '@/constants/catalog';
import { normalizeSearch } from '@/utils/slugify';
import { normalizeItemCode } from '@/utils/itemCode';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { deleteImageRefs } from '../imageStore';
import {
  applyItemFields,
  ATTRIBUTE_MAX,
  CONDITION_MAX,
  toAdminItem,
  type FeedItemInput,
} from './feeds';

/* ============================================================
   Quản lý từng con Bakugan (không có số lượng: còn bán hoặc SOLD).
   ============================================================ */

/**
 * - `available`: đang bán trên một feed
 * - `sold`     : đã bán (qua đơn hoặc admin tự đánh dấu)
 * - `leftover` : hàng tồn — chưa bán, feed cũ đã bị xoá, chờ đăng lại
 */
export type AdminItemFilter = 'all' | 'available' | 'sold' | 'leftover';

export interface AdminItemQuery {
  status?: AdminItemFilter;
  keyword?: string;
  attribute?: BakuganAttribute | 'all';
  /** Chỉ lấy con bán trong n ngày gần nhất (với tab đã bán), 0 = tất cả */
  soldWithinDays?: number;
  page?: number;
  pageSize?: number;
}

export interface AdminItemList {
  page: Paginated<AdminItem>;
  counts: Record<AdminItemFilter, number>;
  /** Tổng tiền các con đã bán khớp bộ lọc */
  soldValue: number;
}

function filterOf(item: { status: string; feedId?: string }): Exclude<AdminItemFilter, 'all'> {
  if (item.status === 'sold') return 'sold';
  return item.feedId ? 'available' : 'leftover';
}

export async function listAdminItems(query: AdminItemQuery = {}): Promise<AdminItemList> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminItemList>>('/admin/items', {
      params: query,
    });
    return data.data;
  }
  requireAdmin();
  const { status = 'all', keyword = '', attribute = 'all', soldWithinDays = 0 } = query;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? 20;
  const db = readDb();
  const needle = normalizeSearch(keyword);
  const now = Date.now();

  const scoped = db.items
    .map((item) => toAdminItem(db, item))
    .filter((item) => attribute === 'all' || attributeKeyOf(item.attribute) === attribute)
    .filter((item) =>
      soldWithinDays > 0 && item.status === 'sold'
        ? now - new Date(item.soldAt ?? 0).getTime() <= soldWithinDays * 86_400_000
        : soldWithinDays === 0 || item.status !== 'sold',
    )
    .filter((item) =>
      needle
        ? normalizeSearch(
            `${item.name} ${item.code} ${item.code.replace('-', '')} ${item.feedTitle ?? ''} ${item.buyerName ?? ''} ${item.orderCode ?? ''}`,
          ).includes(needle)
        : true,
    );

  const counts: Record<AdminItemFilter, number> = {
    all: scoped.length,
    available: 0,
    sold: 0,
    leftover: 0,
  };
  scoped.forEach((item) => {
    counts[filterOf(item)] += 1;
  });

  const filtered = scoped
    .filter((item) => status === 'all' || filterOf(item) === status)
    .sort((a, b) =>
      status === 'sold'
        ? (b.soldAt ?? '').localeCompare(a.soldAt ?? '')
        : b.code.localeCompare(a.code),
    );
  const total = filtered.length;

  return mockDelay({
    counts,
    soldValue: filtered
      .filter((item) => item.status === 'sold')
      .reduce((sum, item) => sum + item.price, 0),
    page: {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/** Con còn bán (trên feed hoặc hàng tồn) — để admin chọn khi tạo đơn. */
export async function listSellableItems(keyword = ''): Promise<AdminItem[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminItem[]>>('/admin/items/sellable', {
      params: { keyword },
    });
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const needle = normalizeSearch(keyword);
  return mockDelay(
    db.items
      .filter((item) => item.status === 'available')
      .filter((item) =>
        needle
          ? normalizeSearch(`${item.name} ${item.code} ${item.code.replace('-', '')}`).includes(
              needle,
            )
          : true,
      )
      .sort((a, b) => b.code.localeCompare(a.code))
      .slice(0, 30)
      .map((item) => toAdminItem(db, item)),
    120,
  );
}

/** Bán ngoài web (chốt qua Messenger, livestream, bán tại shop) — admin tự đánh dấu SOLD. */
export async function markItemSold(
  itemId: string,
  input: { buyerName?: string; note?: string },
): Promise<AdminItem> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<AdminItem>>(
      `/admin/items/${itemId}/mark-sold`,
      input,
    );
    return data.data;
  }
  requireAdmin();
  const now = new Date().toISOString();
  const item = updateDb((db) => {
    const target = db.items.find((entry) => entry.id === itemId);
    if (!target) throw new MockApiError('Không tìm thấy con Bakugan này.', 404);
    if (target.status === 'sold') throw new MockApiError(`${target.code} đã bán rồi.`, 409);
    const feed = target.feedId ? db.feeds.find((entry) => entry.id === target.feedId) : undefined;
    target.status = 'sold';
    target.soldVia = 'manual';
    target.soldAt = now;
    target.buyerName = input.buyerName?.trim() || undefined;
    target.soldNote = input.note?.trim() || 'Bán ngoài web';
    if (feed) {
      target.feedTitle = feed.title;
      target.feedNumber = feed.number;
    }
    return target;
  });
  return mockDelay(toAdminItem(readDb(), item), 300);
}

/** Bỏ đánh dấu SOLD (chỉ với con admin tự đánh dấu; con bán qua đơn thì huỷ đơn). */
export async function markItemAvailable(itemId: string): Promise<AdminItem> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<AdminItem>>(
      `/admin/items/${itemId}/mark-available`,
    );
    return data.data;
  }
  requireAdmin();
  const item = updateDb((db) => {
    const target = db.items.find((entry) => entry.id === itemId);
    if (!target) throw new MockApiError('Không tìm thấy con Bakugan này.', 404);
    if (target.status !== 'sold') throw new MockApiError(`${target.code} đang còn bán.`, 409);
    if (target.soldVia === 'order') {
      throw new MockApiError(
        `${target.code} được bán qua một đơn hàng — huỷ đơn đó thì con này tự quay lại bán.`,
        409,
      );
    }
    target.status = 'available';
    delete target.soldAt;
    delete target.soldVia;
    delete target.soldNote;
    delete target.buyerName;
    return target;
  });
  return mockDelay(toAdminItem(readDb(), item), 300);
}

/** Sửa thông tin một con (tên, mã, giá, tình trạng, ảnh, video…). Con đã bán không đổi giá. */
export async function updateItem(
  itemId: string,
  input: Omit<FeedItemInput, 'id'>,
): Promise<AdminItem> {
  if (!USE_MOCK) {
    const { data } = await apiClient.put<ApiResponse<AdminItem>>(`/admin/items/${itemId}`, input);
    return data.data;
  }
  requireAdmin();
  if (input.name.trim().length < 2) {
    throw new MockApiError('Tên cần ít nhất 2 ký tự.', 422, { name: 'Tên cần ít nhất 2 ký tự.' });
  }
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new MockApiError('Giá không hợp lệ.', 422, { price: 'Giá không hợp lệ.' });
  }
  const attributeText = input.attribute?.trim() ?? '';
  if (!attributeText || attributeText.length > ATTRIBUTE_MAX) {
    throw new MockApiError(`Ghi hệ (tối đa ${ATTRIBUTE_MAX} ký tự).`, 422, {
      attribute: 'Ghi hệ của con này.',
    });
  }
  if ((input.condition?.trim().length ?? 0) > CONDITION_MAX) {
    throw new MockApiError(`Tình trạng tối đa ${CONDITION_MAX} ký tự.`, 422, {
      condition: `Tối đa ${CONDITION_MAX} ký tự.`,
    });
  }
  const code = input.code?.trim() ? normalizeItemCode(input.code) : undefined;
  if (input.code?.trim() && !code) {
    throw new MockApiError('Mã phải có dạng BK-0123.', 422, { code: 'Mã phải có dạng BK-0123.' });
  }
  if ((input.photos?.length ?? 0) > ITEM_PHOTO_LIMIT) {
    throw new MockApiError(`Mỗi con tối đa ${ITEM_PHOTO_LIMIT} ảnh.`, 422);
  }
  let removedMedia: string[] = [];
  const item = updateDb((db) => {
    const target = db.items.find((entry) => entry.id === itemId);
    if (!target) throw new MockApiError('Không tìm thấy con Bakugan này.', 404);
    if (code && code !== target.code) {
      if (db.items.some((entry) => entry.code === code)) {
        throw new MockApiError(`Mã ${code} đã có con khác dùng.`, 409, {
          code: 'Mã này đã có con khác dùng.',
        });
      }
      target.code = code;
    }
    removedMedia = applyItemFields(target, input, target.status !== 'sold');
    return target;
  });
  if (removedMedia.length > 0) void deleteImageRefs(removedMedia);
  return mockDelay(toAdminItem(readDb(), item), 300);
}

/** Xoá hẳn một con (VD: hư hỏng không bán được). Chỉ với con chưa từng nằm trong đơn nào. */
export async function deleteItem(itemId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.delete(`/admin/items/${itemId}`);
    return;
  }
  requireAdmin();
  const media = updateDb((db) => {
    const target = db.items.find((entry) => entry.id === itemId);
    if (!target) throw new MockApiError('Không tìm thấy con Bakugan này.', 404);
    if (target.status === 'sold') throw new MockApiError('Không xoá được con đã bán.', 409);
    if (db.orders.some((order) => order.items.some((line) => line.itemId === itemId))) {
      throw new MockApiError(
        `${target.code} có trong lịch sử đơn hàng nên không xoá được — hãy đánh dấu đã bán hoặc để ở hàng tồn.`,
        409,
      );
    }
    db.items = db.items.filter((entry) => entry.id !== itemId);
    return itemMediaRefs(target);
  });
  void deleteImageRefs(media);
  await mockDelay(null, 250);
}

import { z } from 'zod';
import { unprocessable } from '../../lib/errors';
import { normalizeItemCode } from '../../shared/catalog';
import { BAKUGAN_SERIES, ITEM_PHOTO_LIMIT, type BakuganSeries } from '../../shared/types';

/*
 * Dữ liệu feed / từng con admin gửi lên. Bước 1 (Zod) chỉ chặn sai kiểu và chuỗi quá dài;
 * bước 2 kiểm tra nghiệp vụ với đúng câu báo lỗi như bản giả lập
 * (src/services/api/admin/feeds.ts: validateFeedInput, admin/items.ts: updateItem).
 */

/** Giới hạn độ dài chữ shop tự gõ (giống web) */
export const NAME_MAX = 80;
export const ATTRIBUTE_MAX = 40;
export const CONDITION_MAX = 160;
export const TITLE_MAX = 150;
export const CAPTION_MAX = 5_000;
export const SUPPLIER_MAX = 150;
export const FEED_IMAGE_LIMIT = 6;
export const FEED_ITEM_LIMIT = 60;

const url = z.string().max(512);
const optionalText = (max: number) => z.string().max(max).nullish();

const itemFields = {
  name: z.string().max(500),
  code: z.string().max(40).nullish(),
  price: z.number(),
  attribute: z.string().max(500),
  series: z.string().max(40).nullish(),
  condition: optionalText(2_000),
  photos: z.array(url).max(20).nullish(),
  video: url.nullish(),
};

export const itemInputSchema = z.object({ ...itemFields });
export const feedItemInputSchema = z.object({ id: z.string().max(36).nullish(), ...itemFields });

export const feedInputSchema = z.object({
  title: z.string().max(1_000),
  caption: z.string().max(20_000).default(''),
  images: z.array(url).max(50).default([]),
  opensAt: z.string().max(40).nullish(),
  lotCost: z.number().nullish(),
  supplier: optionalText(1_000),
  items: z.array(feedItemInputSchema).max(500),
});

export const createFeedSchema = feedInputSchema.extend({
  replaceFeedId: z.string().max(36).nullish(),
  carryLeftovers: z.boolean().nullish(),
});

export type ItemInput = z.infer<typeof itemInputSchema>;
export type FeedItemInput = z.infer<typeof feedItemInputSchema>;
export type FeedInput = z.infer<typeof feedInputSchema>;

/** Một con sau khi đã kiểm tra: chữ đã cắt khoảng trắng, ô trống thành null */
export interface CleanItem {
  id?: string;
  name: string;
  /** Mã đã chuẩn hoá (BK-0231); trống = server tự cấp */
  code?: string;
  price: number;
  attribute: string;
  series: BakuganSeries | null;
  condition: string | null;
  photos: string[];
  video: string | null;
}

export interface CleanFeed {
  title: string;
  caption: string;
  images: string[];
  opensAt?: Date;
  lotCost: number | null;
  supplier: string | null;
  items: CleanItem[];
}

function fail(message: string, field?: string): never {
  throw unprocessable(message, field ? { [field]: message } : undefined);
}

function cleanItem(item: FeedItemInput, label: string): CleanItem {
  const name = item.name.trim();
  const attribute = item.attribute.trim();
  const condition = item.condition?.trim() ?? '';
  if (name.length < 2) fail(`${label}: chưa có tên.`);
  if (name.length > NAME_MAX) fail(`${label}: tên tối đa ${NAME_MAX} ký tự.`);
  if (!Number.isSafeInteger(item.price) || item.price <= 0) fail(`${label}: giá không hợp lệ.`);
  if (!attribute) fail(`${label}: chưa ghi hệ.`);
  if (attribute.length > ATTRIBUTE_MAX) fail(`${label}: hệ tối đa ${ATTRIBUTE_MAX} ký tự.`);
  const series = item.series || null;
  if (series && !BAKUGAN_SERIES.includes(series as BakuganSeries)) {
    fail(`${label}: dòng không hợp lệ.`);
  }
  if (condition.length > CONDITION_MAX) {
    fail(`${label}: tình trạng tối đa ${CONDITION_MAX} ký tự.`);
  }
  const code = item.code?.trim() ? normalizeItemCode(item.code) : undefined;
  if (item.code?.trim() && !code) fail(`${label}: mã "${item.code}" không đúng dạng BK-0123.`);
  const photos = (item.photos ?? []).filter(Boolean);
  if (photos.length > ITEM_PHOTO_LIMIT) fail(`${label}: tối đa ${ITEM_PHOTO_LIMIT} ảnh.`);
  return {
    id: item.id || undefined,
    name,
    code,
    price: item.price,
    attribute,
    series: series as BakuganSeries | null,
    condition: condition || null,
    photos,
    video: item.video || null,
  };
}

/** Kiểm tra feed như bản giả lập. `allowEmptyItems`: đăng feed chỉ gồm hàng tồn mang sang. */
export function cleanFeedInput(input: FeedInput, allowEmptyItems: boolean): CleanFeed {
  const title = input.title.trim();
  if (title.length < 3) fail('Tiêu đề feed cần ít nhất 3 ký tự.', 'title');
  if (title.length > TITLE_MAX) fail(`Tiêu đề feed tối đa ${TITLE_MAX} ký tự.`, 'title');
  if (input.caption.trim().length > CAPTION_MAX) {
    fail(`Mô tả feed tối đa ${CAPTION_MAX.toLocaleString('vi-VN')} ký tự.`, 'caption');
  }
  const images = input.images.filter(Boolean);
  if (images.length > FEED_IMAGE_LIMIT) fail(`Mỗi feed tối đa ${FEED_IMAGE_LIMIT} ảnh.`, 'images');
  if (new Set(images).size !== images.length) fail('Có ảnh bị lặp lại trong feed.', 'images');
  if (!allowEmptyItems && input.items.length === 0) {
    fail('Feed cần ít nhất một con Bakugan.', 'items');
  }
  if (input.items.length > FEED_ITEM_LIMIT)
    fail(`Mỗi feed tối đa ${FEED_ITEM_LIMIT} con.`, 'items');
  let opensAt: Date | undefined;
  if (input.opensAt) {
    opensAt = new Date(input.opensAt);
    if (Number.isNaN(opensAt.getTime())) fail('Giờ mở bán không hợp lệ.', 'opensAt');
  }
  const lotCost = input.lotCost ?? null;
  if (lotCost !== null && (!Number.isSafeInteger(lotCost) || lotCost < 0)) {
    fail('Giá nhập lô không hợp lệ.', 'lotCost');
  }
  const supplier = input.supplier?.trim() ?? '';
  if (supplier.length > SUPPLIER_MAX) {
    fail(`Nhà cung cấp tối đa ${SUPPLIER_MAX} ký tự.`, 'supplier');
  }
  const items = input.items.map((item, index) => cleanItem(item, `Con thứ ${index + 1}`));
  const ids = items.flatMap((item) => (item.id ? [item.id] : []));
  if (new Set(ids).size !== ids.length) fail('Có con Bakugan bị lặp lại trong feed.', 'items');
  return {
    title,
    caption: input.caption.trim(),
    images,
    opensAt,
    // Giá nhập 0 coi như chưa ghi (như web)
    lotCost: lotCost || null,
    supplier: supplier || null,
    items,
  };
}

/** Kiểm tra khi sửa riêng một con (trang Kho), lỗi gắn vào từng ô như bản giả lập. */
export function cleanItemInput(input: ItemInput): Omit<CleanItem, 'id'> {
  const name = input.name.trim();
  if (name.length < 2) fail('Tên cần ít nhất 2 ký tự.', 'name');
  if (name.length > NAME_MAX) fail(`Tên tối đa ${NAME_MAX} ký tự.`, 'name');
  if (!Number.isSafeInteger(input.price) || input.price <= 0) fail('Giá không hợp lệ.', 'price');
  const attribute = input.attribute.trim();
  if (!attribute || attribute.length > ATTRIBUTE_MAX) {
    throw unprocessable(`Ghi hệ (tối đa ${ATTRIBUTE_MAX} ký tự).`, {
      attribute: 'Ghi hệ của con này.',
    });
  }
  const condition = input.condition?.trim() ?? '';
  if (condition.length > CONDITION_MAX) {
    throw unprocessable(`Tình trạng tối đa ${CONDITION_MAX} ký tự.`, {
      condition: `Tối đa ${CONDITION_MAX} ký tự.`,
    });
  }
  const code = input.code?.trim() ? normalizeItemCode(input.code) : undefined;
  if (input.code?.trim() && !code) fail('Mã phải có dạng BK-0123.', 'code');
  const photos = (input.photos ?? []).filter(Boolean);
  if (photos.length > ITEM_PHOTO_LIMIT) fail(`Mỗi con tối đa ${ITEM_PHOTO_LIMIT} ảnh.`);
  const series = input.series || null;
  if (series && !BAKUGAN_SERIES.includes(series as BakuganSeries)) fail('Dòng không hợp lệ.');
  return {
    name,
    code,
    price: input.price,
    attribute,
    series: series as BakuganSeries | null,
    condition: condition || null,
    photos,
    video: input.video || null,
  };
}

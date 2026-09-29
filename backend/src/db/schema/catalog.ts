import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES, ITEM_STATUSES } from '../../shared/types';
import { users } from './accounts';
import { orders } from './orders';
import { createdAtColumn, idColumn, timeColumn, updatedAtColumn, uuidColumn } from './columns';

/**
 * Số thứ tự tăng dần (MySQL không có sequence): số feed, số mã BK.
 * Lấy số trong transaction bằng SELECT … FOR UPDATE rồi cộng 1 (db/counters.ts).
 */
export const counters = mysqlTable('counters', {
  name: varchar('name', { length: 40 }).primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull().default(0),
});

/** Feed = một lô hàng. `retired_at` có giá trị nghĩa là đã gỡ khỏi web. */
export const feeds = mysqlTable(
  'feeds',
  {
    id: idColumn(),
    number: int('number').notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    caption: text('caption').notNull(),
    images: json('images').$type<string[]>().notNull(),
    publishedAt: timeColumn('published_at').notNull(),
    opensAt: timeColumn('opens_at').notNull(),
    lotCost: bigint('lot_cost', { mode: 'number' }),
    supplier: varchar('supplier', { length: 150 }),
    createdBy: uuidColumn('created_by').references(() => users.id, { onDelete: 'set null' }),
    retiredAt: timeColumn('retired_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('feeds_number_uq').on(t.number),
    index('feeds_retired_number_idx').on(t.retiredAt, t.number),
    check('feeds_lot_cost_chk', sql`${t.lotCost} is null or ${t.lotCost} >= 0`),
  ],
);

/**
 * Từng con Bakugan (hàng độc nhất, không có số lượng).
 * - `attribute`, `condition_text`: chữ shop tự gõ.
 * - `attribute_key`: hệ nhận ra được từ chữ đó (attributeKeyOf), để lọc và gắn icon.
 * - `feed_id` trống = hàng tồn; con đã bán giữ lại tên / số feed trong cột *_snapshot.
 */
export const items = mysqlTable(
  'items',
  {
    id: idColumn(),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    price: bigint('price', { mode: 'number' }).notNull(),
    attribute: varchar('attribute', { length: 40 }).notNull(),
    attributeKey: mysqlEnum('attribute_key', BAKUGAN_ATTRIBUTES),
    series: mysqlEnum('series', BAKUGAN_SERIES),
    condition: varchar('condition_text', { length: 160 }),
    photos: json('photos').$type<string[]>().notNull(),
    video: varchar('video', { length: 512 }),
    status: mysqlEnum('status', ITEM_STATUSES).notNull().default('available'),
    soldAt: timeColumn('sold_at'),
    soldVia: mysqlEnum('sold_via', ['order', 'manual']),
    orderId: uuidColumn('order_id').references(() => orders.id),
    soldNote: varchar('sold_note', { length: 255 }),
    buyerName: varchar('buyer_name', { length: 100 }),
    feedId: uuidColumn('feed_id').references(() => feeds.id, { onDelete: 'set null' }),
    position: int('position').notNull().default(0),
    feedTitleSnapshot: varchar('feed_title_snapshot', { length: 150 }),
    feedNumberSnapshot: int('feed_number_snapshot'),
    /** Tên + mã + mã viết liền, đã bỏ dấu bằng normalizeSearch của web */
    searchText: varchar('search_text', { length: 600 }).notNull().default(''),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('items_code_uq').on(t.code),
    index('items_feed_position_idx').on(t.feedId, t.position),
    index('items_status_idx').on(t.status),
    index('items_attribute_key_idx').on(t.attributeKey),
    index('items_order_idx').on(t.orderId),
    index('items_sold_at_idx').on(t.soldAt),
    check('items_price_chk', sql`${t.price} > 0`),
    check('items_sold_at_chk', sql`${t.status} <> 'sold' or ${t.soldAt} is not null`),
  ],
);

/** File ảnh / video đã tải lên ổ mini PC — để chặn link lạ và dọn file không còn dùng. */
export const media = mysqlTable(
  'media',
  {
    id: idColumn(),
    path: varchar('path', { length: 255 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    kind: mysqlEnum('kind', ['image', 'video']).notNull(),
    mime: varchar('mime', { length: 64 }).notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    width: int('width'),
    height: int('height'),
    sha256: char('sha256', { length: 64 }).notNull(),
    uploadedBy: uuidColumn('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    inUse: boolean('in_use').notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (t) => [
    uniqueIndex('media_path_uq').on(t.path),
    uniqueIndex('media_url_uq').on(t.url),
    index('media_in_use_created_idx').on(t.inUse, t.createdAt),
    index('media_sha256_idx').on(t.sha256),
  ],
);

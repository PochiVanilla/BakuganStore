import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES, type ProductAccessory } from '../../shared/types';
import { users } from './accounts';
import { orders } from './orders';
import { createdAtColumn, idColumn, timeColumn, updatedAtColumn, uuidColumn } from './columns';

/** Phiên đấu giá. Hệ và tình trạng là chữ shop tự gõ, như từng con Bakugan. */
export const auctions = mysqlTable(
  'auctions',
  {
    id: idColumn(),
    slug: varchar('slug', { length: 191 }).notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description').notNull(),
    images: json('images').$type<string[]>().notNull(),
    attribute: varchar('attribute', { length: 40 }).notNull(),
    attributeKey: mysqlEnum('attribute_key', BAKUGAN_ATTRIBUTES),
    series: mysqlEnum('series', BAKUGAN_SERIES).notNull(),
    condition: varchar('condition_text', { length: 160 }),
    accessories: json('accessories').$type<ProductAccessory[]>().notNull(),
    startPrice: bigint('start_price', { mode: 'number' }).notNull(),
    currentPrice: bigint('current_price', { mode: 'number' }).notNull(),
    bidStep: bigint('bid_step', { mode: 'number' }).notNull(),
    buyNowPrice: bigint('buy_now_price', { mode: 'number' }),
    startAt: timeColumn('start_at').notNull(),
    endAt: timeColumn('end_at').notNull(),
    originalEndAt: timeColumn('original_end_at').notNull(),
    priceVisibility: mysqlEnum('price_visibility', ['open', 'sealed']).notNull().default('open'),
    antiSnipeMinutes: int('anti_snipe_minutes').notNull().default(0),
    extensionCount: int('extension_count').notNull().default(0),
    bidCount: int('bid_count').notNull().default(0),
    leaderId: uuidColumn('leader_id').references(() => users.id),
    watcherCount: int('watcher_count').notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('auctions_slug_uq').on(t.slug),
    index('auctions_start_idx').on(t.startAt),
    index('auctions_end_idx').on(t.endAt),
    check('auctions_prices_chk', sql`${t.startPrice} > 0 and ${t.bidStep} > 0`),
    check('auctions_current_chk', sql`${t.currentPrice} >= ${t.startPrice}`),
    check('auctions_time_chk', sql`${t.endAt} > ${t.startAt}`),
    check('auctions_anti_snipe_chk', sql`${t.antiSnipeMinutes} between 0 and 60`),
  ],
);

/** Lượt đặt giá. Tên người đặt chỉ admin thấy. */
export const bids = mysqlTable(
  'bids',
  {
    id: idColumn(),
    auctionId: uuidColumn('auction_id')
      .notNull()
      .references(() => auctions.id, { onDelete: 'cascade' }),
    bidderId: uuidColumn('bidder_id')
      .notNull()
      .references(() => users.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    triggeredExtension: boolean('triggered_extension').notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (t) => [
    index('bids_auction_created_idx').on(t.auctionId, t.createdAt),
    index('bids_bidder_idx').on(t.bidderId),
    check('bids_amount_chk', sql`${t.amount} > 0`),
  ],
);

/** Khâu sau phiên: đã tạo đơn cho người thắng, hoặc người thắng bỏ cọc. Mỗi phiên một dòng. */
export const auctionFulfillments = mysqlTable('auction_fulfillments', {
  auctionId: uuidColumn('auction_id')
    .primaryKey()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  status: mysqlEnum('status', ['order-created', 'forfeited']).notNull(),
  orderId: uuidColumn('order_id').references(() => orders.id),
  note: varchar('note', { length: 500 }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

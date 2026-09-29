import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { users } from './accounts';
import { orders } from './orders';
import { createdAtColumn, idColumn, timeColumn, updatedAtColumn, uuidColumn } from './columns';

/** Mã giảm giá. `code` lưu chữ hoa. `expires_at` trống = không hết hạn. */
export const coupons = mysqlTable(
  'coupons',
  {
    code: varchar('code', { length: 40 }).primaryKey(),
    label: varchar('label', { length: 150 }).notNull(),
    type: mysqlEnum('type', ['percent', 'amount', 'shipping']).notNull(),
    value: bigint('value', { mode: 'number' }).notNull(),
    minSubtotal: bigint('min_subtotal', { mode: 'number' }).notNull().default(0),
    maxDiscount: bigint('max_discount', { mode: 'number' }),
    startsAt: timeColumn('starts_at'),
    expiresAt: timeColumn('expires_at'),
    active: boolean('active').notNull().default(true),
    /** Chỉ dùng cho đơn đầu tiên của mỗi tài khoản (VD TDNEW10) */
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    perUserLimit: int('per_user_limit'),
    totalLimit: int('total_limit'),
    usedCount: int('used_count').notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    check('coupons_value_chk', sql`${t.value} >= 0 and ${t.minSubtotal} >= 0`),
    check('coupons_percent_chk', sql`${t.type} <> 'percent' or ${t.value} between 1 and 100`),
    check('coupons_used_chk', sql`${t.usedCount} >= 0`),
  ],
);

/** Lượt dùng mã: ghi cùng transaction với đơn; đơn huỷ thì `released_at` có giá trị (trả lượt). */
export const couponRedemptions = mysqlTable(
  'coupon_redemptions',
  {
    id: idColumn(),
    couponCode: varchar('coupon_code', { length: 40 })
      .notNull()
      .references(() => coupons.code),
    orderId: uuidColumn('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuidColumn('user_id').references(() => users.id),
    releasedAt: timeColumn('released_at'),
    createdAt: createdAtColumn(),
  },
  (t) => [
    uniqueIndex('coupon_redemptions_order_uq').on(t.orderId),
    index('coupon_redemptions_coupon_user_idx').on(t.couponCode, t.userId),
  ],
);

/** Yêu cầu lên Lv2 (nạp tiền hoặc xin xét duyệt). Mỗi khách tối đa một yêu cầu đang chờ. */
export const membershipRequests = mysqlTable(
  'membership_requests',
  {
    id: idColumn(),
    userId: uuidColumn('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', ['deposit', 'review']).notNull(),
    amount: bigint('amount', { mode: 'number' }),
    transferNote: varchar('transfer_note', { length: 100 }),
    message: varchar('message', { length: 1000 }),
    status: mysqlEnum('status', ['pending', 'approved', 'rejected']).notNull().default('pending'),
    resolvedAt: timeColumn('resolved_at'),
    resolvedBy: uuidColumn('resolved_by').references(() => users.id),
    adminNote: varchar('admin_note', { length: 500 }),
    pendingOwner: char('pending_owner', { length: 36 }).generatedAlwaysAs(
      sql`if(\`status\` = 'pending', \`user_id\`, null)`,
      { mode: 'virtual' },
    ),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index('membership_requests_status_created_idx').on(t.status, t.createdAt),
    index('membership_requests_user_idx').on(t.userId),
    uniqueIndex('membership_requests_one_pending_uq').on(t.pendingOwner),
    check('membership_requests_amount_chk', sql`${t.amount} is null or ${t.amount} > 0`),
  ],
);

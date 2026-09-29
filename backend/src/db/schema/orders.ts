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
import {
  CANCEL_REASONS,
  CARD_BRANDS,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type InternationalAddress,
} from '../../shared/types';
import { users } from './accounts';
import { auctions } from './auctions';
import { items } from './catalog';
import { createdAtColumn, idColumn, timeColumn, updatedAtColumn, uuidColumn } from './columns';

/** Đơn hàng. `note` là ghi chú của khách, `internal_note` là ghi chú nội bộ của admin. */
export const orders = mysqlTable(
  'orders',
  {
    id: idColumn(),
    code: varchar('code', { length: 20 }).notNull(),
    userId: uuidColumn('user_id').references(() => users.id),
    customerEmail: varchar('customer_email', { length: 254 }),
    source: mysqlEnum('source', ORDER_SOURCES).notNull(),
    status: mysqlEnum('status', ORDER_STATUSES).notNull().default('pending'),
    paymentMethod: mysqlEnum('payment_method', PAYMENT_METHODS).notNull(),
    paymentStatus: mysqlEnum('payment_status', PAYMENT_STATUSES).notNull().default('unpaid'),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
    shippingFee: bigint('shipping_fee', { mode: 'number' }).notNull(),
    discount: bigint('discount', { mode: 'number' }).notNull().default(0),
    total: bigint('total', { mode: 'number' }).notNull(),
    couponCode: varchar('coupon_code', { length: 40 }),
    receiverName: varchar('receiver_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    addressLine: varchar('address_line', { length: 500 }).notNull(),
    shippingRegion: mysqlEnum('shipping_region', ['domestic', 'international'])
      .notNull()
      .default('domestic'),
    intlAddress: json('intl_address').$type<InternationalAddress>(),
    note: varchar('note', { length: 500 }),
    internalNote: text('internal_note'),
    cancelReason: mysqlEnum('cancel_reason', CANCEL_REASONS),
    cancelNote: varchar('cancel_note', { length: 500 }),
    auctionId: uuidColumn('auction_id').references(() => auctions.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('orders_code_uq').on(t.code),
    index('orders_user_created_idx').on(t.userId, t.createdAt),
    index('orders_status_created_idx').on(t.status, t.createdAt),
    index('orders_created_idx').on(t.createdAt),
    index('orders_auction_idx').on(t.auctionId),
    check(
      'orders_amounts_chk',
      sql`${t.subtotal} >= 0 and ${t.shippingFee} >= 0 and ${t.discount} >= 0`,
    ),
    check(
      'orders_total_chk',
      sql`${t.total} = greatest(0, ${t.subtotal} + ${t.shippingFee} - ${t.discount})`,
    ),
  ],
);

/** Dòng hàng trong đơn: chụp lại tên, mã, giá, ảnh lúc mua. */
export const orderItems = mysqlTable(
  'order_items',
  {
    id: idColumn(),
    orderId: uuidColumn('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // Không xoá được con Bakugan đã từng nằm trong đơn (khoá ngoại mặc định RESTRICT).
    itemId: uuidColumn('item_id').references(() => items.id),
    auctionId: uuidColumn('auction_id').references(() => auctions.id),
    code: varchar('code', { length: 20 }),
    name: varchar('name', { length: 150 }).notNull(),
    price: bigint('price', { mode: 'number' }).notNull(),
    image: varchar('image', { length: 512 }).notNull().default(''),
    position: int('position').notNull().default(0),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId, t.position),
    index('order_items_item_idx').on(t.itemId),
    check('order_items_price_chk', sql`${t.price} >= 0`),
  ],
);

/** Lịch sử đơn: ai đổi trạng thái, lúc nào, ghi chú gì. */
export const orderEvents = mysqlTable(
  'order_events',
  {
    id: idColumn(),
    orderId: uuidColumn('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: mysqlEnum('status', ORDER_STATUSES).notNull(),
    at: timeColumn('at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    actorType: mysqlEnum('actor_type', ['customer', 'admin', 'system', 'gateway']).notNull(),
    actorId: uuidColumn('actor_id'),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    note: varchar('note', { length: 1000 }),
  },
  (t) => [index('order_events_order_at_idx').on(t.orderId, t.at)],
);

/** Thanh toán thẻ của một đơn (một đơn một dòng). Không bao giờ có số thẻ đầy đủ. */
export const cardPayments = mysqlTable('card_payments', {
  orderId: uuidColumn('order_id')
    .primaryKey()
    .references(() => orders.id, { onDelete: 'cascade' }),
  expiresAt: timeColumn('expires_at').notNull(),
  attempts: int('attempts').notNull().default(0),
  brand: mysqlEnum('brand', CARD_BRANDS),
  last4: char('last4', { length: 4 }),
  transactionId: varchar('transaction_id', { length: 100 }),
  paidAt: timeColumn('paid_at'),
  lastError: varchar('last_error', { length: 255 }),
  refundedAt: timeColumn('refunded_at'),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

/** Mỗi lần khách mở trang cổng thẻ là một lượt; id lượt là mã giao dịch gửi cổng. */
export const paymentAttempts = mysqlTable(
  'payment_attempts',
  {
    id: idColumn(),
    orderId: uuidColumn('order_id')
      .notNull()
      .references(() => orders.id),
    gateway: varchar('gateway', { length: 20 }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: mysqlEnum('status', ['open', 'succeeded', 'failed', 'closed'])
      .notNull()
      .default('open'),
    gatewayTxnId: varchar('gateway_txn_id', { length: 100 }),
    brand: mysqlEnum('brand', CARD_BRANDS),
    last4: char('last4', { length: 4 }),
    responseCode: varchar('response_code', { length: 20 }),
    message: varchar('message', { length: 255 }),
    createdAt: createdAtColumn(),
    finishedAt: timeColumn('finished_at'),
  },
  (t) => [
    index('payment_attempts_order_idx').on(t.orderId),
    index('payment_attempts_status_created_idx').on(t.status, t.createdAt),
    uniqueIndex('payment_attempts_gateway_txn_uq').on(t.gateway, t.gatewayTxnId),
    check('payment_attempts_amount_chk', sql`${t.amount} > 0`),
  ],
);

/** Mọi lần cổng thanh toán gọi về (IPN). `event_key` duy nhất: cổng gửi lặp chỉ xử lý một lần. */
export const paymentEvents = mysqlTable(
  'payment_events',
  {
    id: idColumn(),
    gateway: varchar('gateway', { length: 20 }).notNull(),
    eventKey: varchar('event_key', { length: 191 }).notNull(),
    attemptId: uuidColumn('attempt_id').references(() => paymentAttempts.id),
    /** Dữ liệu cổng gửi, đã bỏ trường nhạy cảm */
    payload: json('payload').$type<Record<string, unknown>>().notNull(),
    signatureOk: boolean('signature_ok').notNull(),
    result: varchar('result', { length: 40 }).notNull(),
    createdAt: createdAtColumn(),
  },
  (t) => [
    uniqueIndex('payment_events_event_key_uq').on(t.eventKey),
    index('payment_events_attempt_idx').on(t.attemptId),
  ],
);

/**
 * Lệnh hoàn tiền — CHỈ tạo khi admin bấm "Hoàn tiền". Hệ thống không bao giờ tự hoàn.
 * Mỗi lượt thanh toán chỉ một lệnh đang chạy hoặc đã xong (cột sinh + UNIQUE).
 */
export const refunds = mysqlTable(
  'refunds',
  {
    id: idColumn(),
    orderId: uuidColumn('order_id')
      .notNull()
      .references(() => orders.id),
    attemptId: uuidColumn('attempt_id')
      .notNull()
      .references(() => paymentAttempts.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: mysqlEnum('status', ['pending', 'succeeded', 'failed']).notNull().default('pending'),
    gatewayRefundId: varchar('gateway_refund_id', { length: 100 }),
    requestedBy: uuidColumn('requested_by')
      .notNull()
      .references(() => users.id),
    error: varchar('error', { length: 255 }),
    activeAttempt: char('active_attempt', { length: 36 }).generatedAlwaysAs(
      sql`if(\`status\` in ('pending', 'succeeded'), \`attempt_id\`, null)`,
      { mode: 'virtual' },
    ),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index('refunds_order_idx').on(t.orderId),
    uniqueIndex('refunds_one_active_uq').on(t.activeAttempt),
    check('refunds_amount_chk', sql`${t.amount} > 0`),
  ],
);

/**
 * Sự cố đơn hàng. Sự cố tiền do hệ thống mở (trả trễ, trả trùng, sai số tiền) có
 * type = 'payment', reported_by = 'system' và gắn đúng một lượt thanh toán.
 */
export const orderIssues = mysqlTable(
  'order_issues',
  {
    id: idColumn(),
    orderId: uuidColumn('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: mysqlEnum('type', ISSUE_TYPES).notNull(),
    status: mysqlEnum('status', ISSUE_STATUSES).notNull().default('open'),
    description: text('description').notNull(),
    reportedBy: mysqlEnum('reported_by', ['admin', 'customer', 'carrier', 'system']).notNull(),
    paymentAttemptId: uuidColumn('payment_attempt_id').references(() => paymentAttempts.id),
    resolution: text('resolution'),
    createdBy: uuidColumn('created_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timeColumn('resolved_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index('order_issues_status_created_idx').on(t.status, t.createdAt),
    index('order_issues_order_idx').on(t.orderId),
    uniqueIndex('order_issues_payment_attempt_uq').on(t.paymentAttemptId),
  ],
);

/** Idempotency-Key của lần bấm đặt hàng: gửi lại cũng không ra hai đơn. Giữ 24 giờ. */
export const idempotencyKeys = mysqlTable(
  'idempotency_keys',
  {
    id: idColumn(),
    userId: uuidColumn('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    idemKey: varchar('idem_key', { length: 100 }).notNull(),
    route: varchar('route', { length: 100 }).notNull(),
    requestHash: char('request_hash', { length: 64 }).notNull(),
    responseStatus: int('response_status'),
    response: json('response').$type<unknown>(),
    createdAt: createdAtColumn(),
  },
  (t) => [
    uniqueIndex('idempotency_keys_user_key_uq').on(t.userId, t.idemKey),
    index('idempotency_keys_created_idx').on(t.createdAt),
  ],
);

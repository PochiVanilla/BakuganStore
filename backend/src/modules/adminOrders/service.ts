import { and, asc, count, desc, eq, gte, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Request } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { items, orderIssues, orderItems, orders, users } from '../../db/schema';
import { withTransaction } from '../../db/tx';
import { writeAudit } from '../../lib/audit';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { currentUser } from '../../middleware/auth';
import { emailSchema, fullNameSchema, phoneSchema } from '../../shared/authSchemas';
import { normalizeSearch } from '../../shared/catalog';
import { ACTIVE_ORDER_STATUSES, ORDER_TRANSITIONS } from '../../shared/orders';
import {
  CANCEL_REASONS,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  MANUAL_PAYMENT_METHODS,
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderIssue,
  type Paginated,
} from '../../shared/types';
import type { FeedCatalog } from '../catalog/store';
import { likePattern } from '../catalog/itemList';
import { applyPurchaseUpgrade } from '../membership/rules';
import {
  addEvent,
  adminActor,
  cancelOrder,
  recordStatus,
  releaseItems,
  sellItems,
} from '../orders/mutations';
import { newOrderCode } from '../orders/placeOrder';
import { loadOrder, loadOrders, lockOrder, type OrderView } from '../orders/store';
import { refundCardOrder, type PaymentDeps } from '../payments/service';

/*
 * Admin xử lý đơn (kế hoạch 8.8), làm đúng như bản giả lập (src/services/api/admin/orders.ts)
 * nhưng trong transaction có khoá dòng đơn. Mọi thao tác ghi nhật ký admin.
 */

export const ORDER_NOT_FOUND = 'Không tìm thấy đơn hàng này.';

export interface AdminOrderDeps {
  db: Db;
  catalog: FeedCatalog;
  payments: PaymentDeps;
}

/* ---------------- Danh sách ---------------- */

const STATUS_FILTERS = ['all', 'active', ...ORDER_STATUSES] as const;
type OrderStatusFilter = (typeof STATUS_FILTERS)[number];

export const adminOrderQuerySchema = z.object({
  status: z.enum(STATUS_FILTERS).default('all'),
  source: z.enum(['all', ...ORDER_SOURCES]).default('all'),
  keyword: z.string().max(100).default(''),
  days: z.coerce.number().int().min(0).max(3_650).default(0),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

function scopeOf(query: AdminOrderQuery): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];
  if (query.source !== 'all') conditions.push(eq(orders.source, query.source));
  if (query.days > 0) {
    conditions.push(gte(orders.createdAt, sql`UTC_TIMESTAMP(3) - INTERVAL ${query.days} DAY`));
  }
  const needle = normalizeSearch(query.keyword);
  if (needle) {
    // Bảng dùng utf8mb4_0900_ai_ci: so khớp không phân biệt dấu / hoa thường.
    const pattern = likePattern(needle);
    conditions.push(
      or(
        sql`${orders.code} LIKE ${pattern}`,
        sql`${orders.receiverName} LIKE ${pattern}`,
        sql`${orders.phone} LIKE ${pattern}`,
        sql`${orders.customerEmail} LIKE ${pattern}`,
        sql`EXISTS (SELECT 1 FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id}
          AND (${orderItems.name} LIKE ${pattern} OR ${orderItems.code} LIKE ${pattern}
            OR REPLACE(${orderItems.code}, '-', '') LIKE ${pattern}))`,
      ),
    );
  }
  return and(...conditions);
}

function statusCondition(status: OrderStatusFilter): SQL | undefined {
  if (status === 'all') return undefined;
  if (status === 'active') return inArray(orders.status, [...ACTIVE_ORDER_STATUSES]);
  return eq(orders.status, status);
}

export async function listAdminOrders(db: Db, query: AdminOrderQuery) {
  const scope = scopeOf(query);
  const grouped = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .where(scope)
    .groupBy(orders.status);
  const counts = Object.fromEntries(STATUS_FILTERS.map((value) => [value, 0])) as Record<
    OrderStatusFilter,
    number
  >;
  for (const row of grouped) {
    counts[row.status] = Number(row.total);
    counts.all += Number(row.total);
    if (ACTIVE_ORDER_STATUSES.includes(row.status)) counts.active += Number(row.total);
  }
  const total = counts[query.status];
  const page: Paginated<OrderView> = {
    items: await loadOrders(db, 'admin', {
      where: and(scope, statusCondition(query.status)),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
  return { page, counts };
}

export async function getAdminOrder(db: Db, orderId: string): Promise<OrderView> {
  const order = await loadOrder(db, orderId, 'admin');
  if (!order) throw notFound(ORDER_NOT_FOUND);
  return order;
}

/* ---------------- Đổi trạng thái ---------------- */

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(1_000).optional(),
  cancelReason: z.enum(CANCEL_REASONS).optional(),
  restock: z.boolean().optional(),
});

export async function updateOrderStatus(
  deps: AdminOrderDeps,
  req: Request,
  orderId: string,
  input: z.infer<typeof updateStatusSchema>,
): Promise<OrderView> {
  const admin = adminActor(currentUser(req));
  const released = await withTransaction(deps.db, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw notFound(ORDER_NOT_FOUND);
    if (!ORDER_TRANSITIONS[order.status].includes(input.status)) {
      throw conflict('Không thể chuyển đơn sang trạng thái này từ trạng thái hiện tại.');
    }
    if (input.status === 'cancelled' && !input.cancelReason) {
      throw unprocessable('Vui lòng chọn lý do huỷ đơn.', {
        cancelReason: 'Vui lòng chọn lý do huỷ đơn.',
      });
    }
    const note = input.note?.trim() || undefined;
    const at = new Date();
    let released = 0;
    if (input.status === 'cancelled') {
      // Hàng chưa rời shop nên những con trong đơn được mở bán lại ngay.
      released = await cancelOrder(tx, order, {
        reason: input.cancelReason!,
        note,
        actor: admin,
        at,
      });
    } else {
      if (input.status === 'returned' && input.restock) released = await releaseItems(tx, order.id);
      if (input.status === 'completed' && order.paymentMethod === 'cod') {
        await tx.update(orders).set({ paymentStatus: 'paid' }).where(eq(orders.id, order.id));
      }
      await recordStatus(tx, order.id, input.status, admin, note, at);
      // Khách nhận đủ 3 Bakugan thì tự lên thành viên Lv2.
      if (input.status === 'completed' && order.userId) {
        await applyPurchaseUpgrade(tx, order.userId, at);
      }
    }
    await writeAudit(tx, req, {
      action: 'order.status',
      targetType: 'order',
      targetId: order.id,
      detail: { code: order.code, from: order.status, to: input.status },
    });
    return released;
  });
  if (released > 0) deps.catalog.invalidate();
  return getAdminOrder(deps.db, orderId);
}

/* ---------------- Thanh toán ---------------- */

export const updatePaymentSchema = z.object({ paymentStatus: z.enum(PAYMENT_STATUSES) });

const PAYMENT_NOTES = {
  paid: 'Xác nhận đã nhận tiền.',
  unpaid: 'Đánh dấu chưa thanh toán.',
  refunded: 'Đã hoàn tiền cho khách.',
} as const;

export async function updatePaymentStatus(
  deps: AdminOrderDeps,
  req: Request,
  orderId: string,
  paymentStatus: z.infer<typeof updatePaymentSchema>['paymentStatus'],
): Promise<OrderView> {
  const user = currentUser(req);
  const admin = adminActor(user);
  const [current] = await deps.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!current) throw notFound(ORDER_NOT_FOUND);

  // Đơn trả thẻ: tiền do cổng xác nhận; hoàn tiền là lệnh gửi sang cổng (chỉ khi admin bấm).
  if (current.paymentMethod === 'card') {
    if (paymentStatus !== 'refunded') {
      throw conflict(
        'Đơn trả bằng thẻ được cổng thanh toán tự xác nhận — không đánh dấu tay được.',
      );
    }
    await refundCardOrder(deps.payments, orderId, { ...admin, id: user.id });
    await writeAudit(deps.db, req, {
      action: 'order.refund',
      targetType: 'order',
      targetId: orderId,
      detail: { code: current.code, amount: current.total },
    });
    return getAdminOrder(deps.db, orderId);
  }

  await withTransaction(deps.db, async (tx) => {
    const order = (await lockOrder(tx, orderId))!;
    if (paymentStatus === 'refunded') {
      if (order.paymentStatus !== 'paid') {
        throw conflict('Đơn này chưa thanh toán nên không có gì để hoàn.');
      }
      if (order.status !== 'cancelled' && order.status !== 'returned') {
        throw conflict('Chỉ hoàn tiền cho đơn đã huỷ hoặc đã hoàn hàng.');
      }
    }
    if (order.paymentStatus === paymentStatus) return;
    await tx.update(orders).set({ paymentStatus }).where(eq(orders.id, orderId));
    await addEvent(tx, orderId, order.status, admin, PAYMENT_NOTES[paymentStatus]);
    await writeAudit(tx, req, {
      action: 'order.payment',
      targetType: 'order',
      targetId: orderId,
      detail: { code: order.code, from: order.paymentStatus, to: paymentStatus },
    });
  });
  return getAdminOrder(deps.db, orderId);
}

/* ---------------- Ghi chú nội bộ ---------------- */

export const internalNoteSchema = z
  .object({
    internalNote: z.string().max(500, 'Ghi chú tối đa 500 ký tự.').optional(),
    /** Bản web cũ gửi `note` cho ô ghi chú nội bộ */
    note: z.string().max(500, 'Ghi chú tối đa 500 ký tự.').optional(),
  })
  .transform((value) => (value.internalNote ?? value.note ?? '').trim());

export async function updateInternalNote(
  deps: AdminOrderDeps,
  req: Request,
  orderId: string,
  note: string,
): Promise<OrderView> {
  await withTransaction(deps.db, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw notFound(ORDER_NOT_FOUND);
    // Ghi chú nội bộ để ở cột riêng, không đè ghi chú khách viết lúc đặt hàng.
    await tx
      .update(orders)
      .set({ internalNote: note || null })
      .where(eq(orders.id, orderId));
    await writeAudit(tx, req, {
      action: 'order.note',
      targetType: 'order',
      targetId: orderId,
      detail: { code: order.code },
    });
  });
  return getAdminOrder(deps.db, orderId);
}

/* ---------------- Tạo đơn tay ---------------- */

const money = (label: string) =>
  z
    .number({ error: `Vui lòng nhập ${label}.` })
    .int(`${label} phải là số nguyên.`)
    .min(0, `${label} không được âm.`)
    .max(1_000_000_000, `${label} quá lớn.`);

export const createOrderSchema = z.object({
  customerId: z.string().max(36).optional(),
  customerEmail: z.union([z.literal(''), emailSchema]).optional(),
  receiverName: fullNameSchema,
  phone: phoneSchema,
  addressLine: z
    .string()
    .trim()
    .min(10, 'Nhập địa chỉ đầy đủ: số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.')
    .max(200, 'Địa chỉ tối đa 200 ký tự.'),
  items: z
    .array(z.object({ itemId: z.string().max(36), price: money('Đơn giá') }))
    .max(60, 'Mỗi đơn tối đa 60 con.'),
  auctionId: z.string().max(36).optional(),
  shippingFee: money('Phí ship'),
  discount: money('Giảm giá'),
  paymentMethod: z.enum(MANUAL_PAYMENT_METHODS, {
    error: 'Đơn tạo tay chỉ chọn COD, chuyển khoản hoặc MoMo.',
  }),
  paymentStatus: z.enum(['unpaid', 'paid']),
  initialStatus: z.enum(['pending', 'confirmed']),
  note: z.string().trim().max(300, 'Ghi chú tối đa 300 ký tự.').optional(),
});

export async function createManualOrder(
  deps: AdminOrderDeps,
  req: Request,
  input: z.infer<typeof createOrderSchema>,
): Promise<OrderView> {
  if (input.auctionId) {
    // Đơn cho người thắng đấu giá làm cùng phần đấu giá chạy thật (giai đoạn 6–8).
    throw conflict('Tạo đơn cho phiên đấu giá chưa có ở bản dữ liệu thật — sẽ có ở giai đoạn sau.');
  }
  if (input.items.length === 0) throw unprocessable('Đơn hàng cần ít nhất một con Bakugan.');
  const admin = adminActor(currentUser(req));
  const orderId = newId();

  await withTransaction(deps.db, async (tx) => {
    let customerEmail = input.customerEmail?.trim() || null;
    if (input.customerId) {
      const [customer] = await tx
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, input.customerId))
        .limit(1);
      if (!customer || customer.role !== 'customer') {
        throw unprocessable('Không tìm thấy khách hàng này.', {
          customerId: 'Chọn một khách hàng.',
        });
      }
      customerEmail ??= customer.email;
    }

    // Server tự tra tên và trạng thái từng con (khoá dòng như khi khách đặt), không tin dữ liệu gửi lên.
    const ids = input.items.map((line) => line.itemId);
    const locked = await tx
      .select()
      .from(items)
      .where(inArray(items.id, ids))
      .orderBy(asc(items.id))
      .for('update');
    const byId = new Map(locked.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const lines = input.items.map((line) => {
      const item = byId.get(line.itemId);
      if (!item) throw unprocessable('Có con Bakugan không còn tồn tại.');
      if (seen.has(item.id)) throw unprocessable(`${item.code} bị chọn hai lần.`);
      seen.add(item.id);
      if (item.status !== 'available') throw conflict(`${item.code} ${item.name} đã bán rồi.`);
      return { item, price: line.price };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.price, 0);
    const discount = Math.min(input.discount, subtotal + input.shippingFee);
    const at = new Date();
    await tx.insert(orders).values({
      id: orderId,
      code: await newOrderCode(tx, at),
      userId: input.customerId ?? null,
      customerEmail,
      source: 'manual',
      status: input.initialStatus,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      subtotal,
      shippingFee: input.shippingFee,
      discount,
      total: subtotal + input.shippingFee - discount,
      receiverName: input.receiverName.trim(),
      phone: input.phone.trim(),
      addressLine: input.addressLine,
      note: input.note || null,
      createdAt: at,
      updatedAt: at,
    });
    await tx.insert(orderItems).values(
      lines.map(({ item, price }, index) => ({
        id: newId(),
        orderId,
        itemId: item.id,
        code: item.code,
        name: item.name,
        price,
        image: item.photos[0] ?? '',
        position: index + 1,
      })),
    );
    await addEvent(tx, orderId, 'pending', admin, 'Admin tạo đơn thủ công.', at);
    if (input.initialStatus === 'confirmed') {
      await addEvent(tx, orderId, 'confirmed', admin, 'Đã xác nhận với khách khi tạo đơn.', at);
    }
    await sellItems(tx, orderId, ids, at);
    await writeAudit(tx, req, {
      action: 'order.create',
      targetType: 'order',
      targetId: orderId,
      detail: { itemCount: lines.length, total: subtotal + input.shippingFee - discount },
    });
  });
  deps.catalog.invalidate();
  return getAdminOrder(deps.db, orderId);
}

/* ---------------- Sự cố ---------------- */

export const createIssueSchema = z.object({
  orderId: z.string().max(36),
  type: z.enum(ISSUE_TYPES),
  description: z
    .string()
    .trim()
    .min(10, 'Mô tả ít nhất 10 ký tự để người xử lý hiểu chuyện gì đã xảy ra.')
    .max(2_000, 'Mô tả tối đa 2.000 ký tự.'),
  reportedBy: z.enum(['admin', 'customer', 'carrier']),
});

export const updateIssueSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  resolution: z.string().max(2_000, 'Cách xử lý tối đa 2.000 ký tự.').optional(),
});

type IssueRow = typeof orderIssues.$inferSelect;

function toIssue(
  row: IssueRow,
  order: { code: string; receiverName: string; customerName: string | null },
): OrderIssue {
  return {
    id: row.id,
    orderId: row.orderId,
    orderCode: order.code,
    customerName: order.customerName ?? order.receiverName,
    type: row.type,
    status: row.status,
    description: row.description,
    reportedBy: row.reportedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolution: row.resolution ?? undefined,
  };
}

export async function listIssues(db: Db, where?: SQL): Promise<OrderIssue[]> {
  const rows = await db
    .select({
      issue: orderIssues,
      code: orders.code,
      receiverName: orders.receiverName,
      customerName: users.fullName,
    })
    .from(orderIssues)
    .innerJoin(orders, eq(orders.id, orderIssues.orderId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(where)
    .orderBy(desc(orderIssues.createdAt));
  return rows.map((row) => toIssue(row.issue, row));
}

export async function createIssue(
  db: Db,
  req: Request,
  input: z.infer<typeof createIssueSchema>,
): Promise<OrderIssue> {
  const id = newId();
  await withTransaction(db, async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, code: orders.code })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);
    if (!order) throw notFound('Không tìm thấy đơn hàng để gắn sự cố.');
    await tx.insert(orderIssues).values({
      id,
      orderId: order.id,
      type: input.type,
      status: 'open',
      description: input.description,
      reportedBy: input.reportedBy,
      createdBy: currentUser(req).id,
    });
    await writeAudit(tx, req, {
      action: 'issue.create',
      targetType: 'issue',
      targetId: id,
      detail: { orderCode: order.code, type: input.type },
    });
  });
  const [issue] = await listIssues(db, eq(orderIssues.id, id));
  return issue!;
}

export async function updateIssue(
  db: Db,
  req: Request,
  issueId: string,
  input: z.infer<typeof updateIssueSchema>,
): Promise<OrderIssue> {
  const resolution = input.resolution?.trim();
  if (input.status === 'resolved' && !resolution) {
    throw unprocessable('Ghi lại cách đã xử lý trước khi đóng sự cố.', {
      resolution: 'Ghi lại cách đã xử lý trước khi đóng sự cố.',
    });
  }
  await withTransaction(db, async (tx) => {
    const [issue] = await tx
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, issueId))
      .for('update');
    if (!issue) throw notFound('Không tìm thấy sự cố này.');
    await tx
      .update(orderIssues)
      .set({
        status: input.status,
        resolution: resolution || issue.resolution,
        resolvedAt: input.status === 'resolved' ? new Date() : null,
      })
      .where(eq(orderIssues.id, issueId));
    await writeAudit(tx, req, {
      action: 'issue.update',
      targetType: 'issue',
      targetId: issueId,
      detail: { status: input.status },
    });
  });
  const [issue] = await listIssues(db, eq(orderIssues.id, issueId));
  return issue!;
}

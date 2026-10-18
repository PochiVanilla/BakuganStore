import { and, asc, count, eq, gt, isNull, lte, ne, or } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { couponRedemptions, coupons, orders } from '../../db/schema';
import type { Tx } from '../../db/tx';
import { ApiError, notFound, unprocessable } from '../../lib/errors';
import type { Coupon } from '../../shared/types';

/*
 * Mã giảm giá (bảng coupons). `POST /coupons/apply` chỉ để xem trước; lúc đặt đơn server
 * kiểm tra lại từ đầu, khoá dòng mã, rồi ghi lượt dùng cùng transaction với đơn.
 */

export type CouponRow = typeof coupons.$inferSelect;

export const COUPON_NOT_FOUND = 'Mã giảm giá không tồn tại hoặc đã hết hạn.';

export function toCoupon(row: CouponRow): Coupon {
  return {
    code: row.code,
    label: row.label,
    type: row.type,
    value: row.value,
    minSubtotal: row.minSubtotal,
    maxDiscount: row.maxDiscount ?? undefined,
    expiresAt: row.expiresAt?.toISOString() ?? '',
  };
}

/** Mã đang dùng được (đang bật, đã tới ngày bắt đầu, chưa hết hạn). */
export async function listActiveCoupons(db: Db): Promise<Coupon[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.active, true),
        or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
        or(isNull(coupons.expiresAt), gt(coupons.expiresAt, now)),
      ),
    )
    .orderBy(asc(coupons.minSubtotal), asc(coupons.code));
  return rows.map(toCoupon);
}

/**
 * Kiểm tra mã cho một đơn. `userId`: kiểm tra thêm "chỉ đơn đầu tiên" và số lượt mỗi khách.
 * `lock`: khoá dòng mã tới hết transaction (khi đặt đơn thật).
 */
export async function checkCoupon(
  executor: Db | Tx,
  rawCode: string,
  subtotal: number,
  options: { userId?: string; lock?: boolean } = {},
): Promise<CouponRow> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length > 40) throw notFound(COUPON_NOT_FOUND);
  const query = executor.select().from(coupons).where(eq(coupons.code, code)).$dynamic();
  const [row] = options.lock ? await query.for('update') : await query;
  const now = Date.now();
  if (!row || !row.active || (row.startsAt && row.startsAt.getTime() > now)) {
    throw notFound(COUPON_NOT_FOUND);
  }
  if (row.expiresAt && row.expiresAt.getTime() < now) {
    throw new ApiError(410, 'Mã giảm giá đã hết hạn.');
  }
  if (subtotal < row.minSubtotal) {
    throw unprocessable(`Mã này áp dụng cho đơn từ ${row.minSubtotal.toLocaleString('vi-VN')}₫.`);
  }
  if (row.totalLimit !== null && row.usedCount >= row.totalLimit) {
    throw unprocessable('Mã này đã hết lượt sử dụng.');
  }
  if (options.userId) {
    if (row.firstOrderOnly) {
      const [{ total } = { total: 0 }] = await executor
        .select({ total: count() })
        .from(orders)
        .where(and(eq(orders.userId, options.userId), ne(orders.status, 'cancelled')));
      if (total > 0) throw unprocessable('Mã này chỉ dành cho đơn đầu tiên của bạn.');
    }
    if (row.perUserLimit !== null) {
      const [{ total } = { total: 0 }] = await executor
        .select({ total: count() })
        .from(couponRedemptions)
        .where(
          and(
            eq(couponRedemptions.couponCode, row.code),
            eq(couponRedemptions.userId, options.userId),
            isNull(couponRedemptions.releasedAt),
          ),
        );
      if (total >= row.perUserLimit) throw unprocessable('Bạn đã dùng hết lượt của mã này.');
    }
  }
  return row;
}

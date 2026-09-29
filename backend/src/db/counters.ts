import { eq, sql } from 'drizzle-orm';
import { counters } from './schema';
import type { Tx } from './tx';

/** Tên các bộ đếm đang dùng */
export const COUNTERS = {
  feedNumber: 'feed_number',
  itemCode: 'item_code',
} as const;

/**
 * Khoá dòng của bộ đếm tới hết transaction và trả về giá trị hiện tại.
 * Các transaction khác gọi cùng bộ đếm phải xếp hàng chờ (VD hai admin đăng feed cùng lúc).
 */
export async function lockCounter(tx: Tx, name: string): Promise<number> {
  await tx
    .insert(counters)
    .values({ name, value: 0 })
    .onDuplicateKeyUpdate({ set: { name: sql`${counters.name}` } });
  const [row] = await tx.select().from(counters).where(eq(counters.name, name)).for('update');
  if (!row) throw new Error(`Không khoá được bộ đếm ${name}`);
  return row.value;
}

/** Lấy số kế tiếp (1, 2, 3…) — chỉ dùng trong transaction. */
export async function nextCounter(tx: Tx, name: string): Promise<number> {
  const next = (await lockCounter(tx, name)) + 1;
  await tx.update(counters).set({ value: next }).where(eq(counters.name, name));
  return next;
}

/** Đặt lại giá trị bộ đếm khi số đã dùng vượt lên (VD admin tự gõ mã BK lớn hơn). */
export async function raiseCounter(tx: Tx, name: string, atLeast: number): Promise<void> {
  const current = await lockCounter(tx, name);
  if (atLeast > current) {
    await tx.update(counters).set({ value: atLeast }).where(eq(counters.name, name));
  }
}

import { eq, sql } from 'drizzle-orm';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { lockCounter, nextCounter } from '../../src/db/counters';
import { withNamedLock } from '../../src/db/locks';
import {
  addresses,
  blogPosts,
  coupons,
  counters,
  orders,
  settings,
  users,
} from '../../src/db/schema';
import { ensureBaseData } from '../../src/db/seed';
import { isRetryableTxError, withTransaction } from '../../src/db/tx';
import { newId } from '../../src/lib/ids';
import { openTestDatabase } from '../helpers';

let database: Database;

beforeAll(async () => {
  database = await openTestDatabase();
});
afterAll(async () => {
  await database.close();
});

async function newUser(email = `${newId()}@test.vn`): Promise<string> {
  const id = newId();
  await database.db.insert(users).values({ id, email, passwordHash: 'x', fullName: 'Khách thử' });
  return id;
}

describe('migration và dữ liệu ban đầu', () => {
  it('tạo đủ 31 bảng, InnoDB, utf8mb4', async () => {
    const [rows] = await database.pool.query<RowDataPacket[]>(
      `SELECT table_name AS name, engine AS engine, table_collation AS collation
         FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name <> '__drizzle_migrations'`,
    );
    expect(rows).toHaveLength(31);
    for (const row of rows) {
      expect(row.engine).toBe('InnoDB');
      expect(String(row.collation)).toMatch(/^utf8mb4/);
    }
  });

  it('chạy lại migration không làm gì thêm (an toàn khi khởi động lại)', async () => {
    const again = await openTestDatabase();
    await again.close();
  });

  it('dữ liệu ban đầu: cài đặt, 3 mã giảm giá, 6 bài blog; bản thật tắt thẻ', async () => {
    const shop = await database.db.select().from(settings).where(eq(settings.name, 'shop'));
    expect(shop[0]?.value).toMatchObject({
      cardPayments: false,
      international: { enabled: false },
    });
    const couponRows = await database.db.select().from(coupons);
    expect(couponRows.map((row) => row.code).sort()).toEqual(['BAKUGAN200', 'FREESHIP', 'TDNEW10']);
    expect(couponRows.find((row) => row.code === 'TDNEW10')?.firstOrderOnly).toBe(true);
    const posts = await database.db.select().from(blogPosts);
    expect(posts).toHaveLength(6);
    expect(posts.every((post) => post.viewCount === 0)).toBe(true);
  });

  it('không tạo lại thứ admin đã xoá hay sửa', async () => {
    await database.db
      .update(coupons)
      .set({ label: 'Admin đã sửa' })
      .where(eq(coupons.code, 'TDNEW10'));
    await database.db.delete(coupons).where(eq(coupons.code, 'BAKUGAN200'));
    const { created } = await ensureBaseData(database.db);
    expect(created).toEqual([]);
    const rows = await database.db.select().from(coupons);
    expect(rows.find((row) => row.code === 'TDNEW10')?.label).toBe('Admin đã sửa');
    expect(rows.find((row) => row.code === 'BAKUGAN200')).toBeUndefined();
  });

  it('thiếu cài đặt (VD lỡ tay xoá) thì tạo lại khi khởi động', async () => {
    await database.db.delete(settings).where(eq(settings.name, 'bot'));
    const { created } = await ensureBaseData(database.db);
    expect(created).toEqual(['settings.bot']);
  });
});

describe('ràng buộc trong CSDL', () => {
  it('mỗi khách chỉ một địa chỉ mặc định (cột sinh + UNIQUE)', async () => {
    const userId = await newUser();
    const address = {
      userId,
      receiverName: 'A',
      phone: '0901234567',
      province: 'P',
      district: 'D',
      ward: 'W',
      street: 'S',
    };
    await database.db.insert(addresses).values({ id: newId(), ...address, isDefault: true });
    await database.db.insert(addresses).values({ id: newId(), ...address, isDefault: false });
    await expect(
      database.db.insert(addresses).values({ id: newId(), ...address, isDefault: true }),
    ).rejects.toThrow();
  });

  it('tổng tiền đơn phải bằng max(0, tạm tính + ship − giảm)', async () => {
    const base = {
      source: 'web' as const,
      paymentMethod: 'cod' as const,
      receiverName: 'A',
      phone: '0901234567',
      addressLine: '1 Hồng Bàng',
    };
    await database.db
      .insert(orders)
      .values({
        id: newId(),
        code: `TD${Date.now()}`,
        ...base,
        subtotal: 100_000,
        shippingFee: 30_000,
        discount: 0,
        total: 130_000,
      });
    await expect(
      database.db
        .insert(orders)
        .values({
          id: newId(),
          code: `TX${Date.now()}`,
          ...base,
          subtotal: 100_000,
          shippingFee: 30_000,
          discount: 0,
          total: 1,
        }),
    ).rejects.toThrow();
  });

  it('giờ lưu theo UTC', async () => {
    const [rows] = await database.pool.query<RowDataPacket[]>(
      'SELECT @@session.time_zone AS tz, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS diff',
    );
    expect(rows[0]).toMatchObject({ tz: '+00:00', diff: 0 });
    const userId = await newUser();
    const [row] = await database.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(Math.abs(row!.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
  });
});

describe('transaction, bộ đếm, khoá tên', () => {
  it('20 transaction cùng lấy số: ra đúng 1…20, không trùng, không sót', async () => {
    const name = `t-${newId().slice(-12)}`;
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => withTransaction(database.db, (tx) => nextCounter(tx, name))),
    );
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const [row] = await database.db.select().from(counters).where(eq(counters.name, name));
    expect(row?.value).toBe(20);
  });

  it('deadlock thật (hai bên khoá ngược thứ tự): bên bị InnoDB huỷ tự chạy lại và xong', async () => {
    const a = `dl-a-${newId().slice(-12)}`;
    const b = `dl-b-${newId().slice(-12)}`;
    await withTransaction(database.db, async (tx) => {
      await lockCounter(tx, a);
      await lockCounter(tx, b);
    });
    let arrived = 0;
    let release!: () => void;
    const bothLocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const attempts = { ab: 0, ba: 0 };
    const run = (key: 'ab' | 'ba', first: string, second: string) =>
      withTransaction(database.db, async (tx) => {
        attempts[key] += 1;
        await lockCounter(tx, first);
        if (attempts[key] === 1) {
          arrived += 1;
          if (arrived === 2) release();
          await bothLocked;
        }
        await lockCounter(tx, second);
        return key;
      });
    const results = await Promise.all([run('ab', a, b), run('ba', b, a)]);
    expect(results.sort()).toEqual(['ab', 'ba']);
    expect(attempts.ab + attempts.ba).toBe(3);
  });

  it('nhận ra lỗi deadlock / chờ khoá kể cả khi bị Drizzle bọc', () => {
    expect(isRetryableTxError({ errno: 1213 })).toBe(true);
    expect(isRetryableTxError(Object.assign(new Error('wrap'), { cause: { errno: 1205 } }))).toBe(
      true,
    );
    expect(isRetryableTxError({ errno: 1062 })).toBe(false);
    expect(isRetryableTxError(new Error('khác'))).toBe(false);
  });

  it('lỗi khác (VD trùng khoá) không chạy lại và transaction được huỷ sạch', async () => {
    const email = `${newId()}@test.vn`;
    let runs = 0;
    await expect(
      withTransaction(database.db, async (tx) => {
        runs += 1;
        await tx.insert(users).values({ id: newId(), email, passwordHash: 'x', fullName: 'A' });
        await tx.insert(users).values({ id: newId(), email, passwordHash: 'x', fullName: 'B' });
      }),
    ).rejects.toThrow();
    expect(runs).toBe(1);
    const rows = await database.db.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  it('khoá tên: một nơi đang giữ thì nơi khác không lấy được', async () => {
    let releaseFirst!: () => void;
    const holding = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withNamedLock(database.pool, 'job:test', 5, () => holding.then(() => 'first'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = await withNamedLock(database.pool, 'job:test', 0, async () => 'second');
    expect(second).toEqual({ acquired: false });
    releaseFirst();
    expect(await first).toEqual({ acquired: true, result: 'first' });
    const third = await withNamedLock(database.pool, 'job:test', 0, async () => 'third');
    expect(third).toEqual({ acquired: true, result: 'third' });
  });

  it('câu SQL thô vẫn dùng được với kết nối của Drizzle', async () => {
    const [rows] = await database.db.execute(sql`SELECT 1 + 1 AS two`);
    expect((rows as unknown as Array<{ two: number }>)[0]?.two).toBe(2);
  });
});

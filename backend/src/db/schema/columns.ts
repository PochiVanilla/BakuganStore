import { sql } from 'drizzle-orm';
import { char, datetime } from 'drizzle-orm/mysql-core';

/*
 * Cột dùng lại ở mọi bảng.
 * - Id: UUID v7 dạng chuỗi 36 ký tự, tạo ở backend (lib/ids.ts).
 * - Thời gian: DATETIME(3) theo giờ UTC (kết nối luôn đặt time_zone = '+00:00').
 */
export const idColumn = () => char('id', { length: 36 }).primaryKey();

export const uuidColumn = (name: string) => char(name, { length: 36 });

export const timeColumn = (name: string) => datetime(name, { mode: 'date', fsp: 3 });

export const createdAtColumn = () =>
  timeColumn('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

export const updatedAtColumn = () =>
  timeColumn('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => new Date());

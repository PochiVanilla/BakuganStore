import { index, int, json, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import type { BlogSection } from '../../shared/types';
import { users } from './accounts';
import { createdAtColumn, idColumn, timeColumn, updatedAtColumn, uuidColumn } from './columns';

/**
 * Cài đặt dạng khoá → JSON: `shop` (ShopSettings), `bot` (BotSettings không có updatedAt),
 * `seed` (đánh dấu đã tạo dữ liệu ban đầu). Mỗi lần đọc / ghi đều kiểm tra bằng Zod.
 */
export const settings = mysqlTable('settings', {
  name: varchar('name', { length: 40 }).primaryKey(),
  value: json('value').$type<unknown>().notNull(),
  updatedBy: uuidColumn('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAtColumn(),
});

export const blogPosts = mysqlTable(
  'blog_posts',
  {
    id: idColumn(),
    slug: varchar('slug', { length: 191 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    excerpt: varchar('excerpt', { length: 500 }).notNull(),
    coverImage: varchar('cover_image', { length: 512 }).notNull().default(''),
    category: varchar('category', { length: 50 }).notNull(),
    tags: json('tags').$type<string[]>().notNull(),
    authorName: varchar('author_name', { length: 100 }).notNull(),
    publishedAt: timeColumn('published_at').notNull(),
    readingMinutes: int('reading_minutes').notNull(),
    viewCount: int('view_count').notNull().default(0),
    sections: json('sections').$type<BlogSection[]>().notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('blog_posts_slug_uq').on(t.slug),
    index('blog_posts_published_idx').on(t.publishedAt),
    index('blog_posts_category_idx').on(t.category),
  ],
);

export const contactMessages = mysqlTable(
  'contact_messages',
  {
    id: idColumn(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull().default(''),
    subject: varchar('subject', { length: 150 }).notNull(),
    message: text('message').notNull(),
    ip: varchar('ip', { length: 45 }),
    handledAt: timeColumn('handled_at'),
    createdAt: createdAtColumn(),
  },
  (t) => [index('contact_messages_created_idx').on(t.createdAt)],
);

export const newsletterSubscribers = mysqlTable(
  'newsletter_subscribers',
  {
    id: idColumn(),
    email: varchar('email', { length: 254 }).notNull(),
    unsubscribedAt: timeColumn('unsubscribed_at'),
    createdAt: createdAtColumn(),
  },
  (t) => [uniqueIndex('newsletter_subscribers_email_uq').on(t.email)],
);

/** Nhật ký thao tác của admin. Không có API nào sửa hay xoá bảng này. */
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: idColumn(),
    actorId: uuidColumn('actor_id'),
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    action: varchar('action', { length: 60 }).notNull(),
    targetType: varchar('target_type', { length: 40 }).notNull(),
    targetId: varchar('target_id', { length: 64 }),
    detail: json('detail').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 45 }),
    createdAt: createdAtColumn(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_target_idx').on(t.targetType, t.targetId),
    index('audit_logs_actor_idx').on(t.actorId),
  ],
);

import { inArray, sql } from 'drizzle-orm';
import { INITIAL_BLOG_POSTS } from '../shared/blogSeed';
import { DEFAULT_COUPONS, INITIAL_BOT_SETTINGS, INITIAL_SHOP_SETTINGS } from '../shared/defaults';
import { newId } from '../lib/ids';
import type { Db } from './client';
import { blogPosts, coupons, settings } from './schema';
import { withTransaction } from './tx';

const DAY = 24 * 60 * 60 * 1000;

/** Tăng số này khi thêm dữ liệu ban đầu mới cho bản đã cài. */
export const SEED_VERSION = 1;

/**
 * Dữ liệu ban đầu của bản thật: cài đặt shop, cài đặt bot, 3 mã giảm giá, 6 bài blog.
 * Không có tài khoản, đơn hay feed mẫu; tài khoản admin tạo bằng lệnh riêng.
 *
 * - Cài đặt: thiếu thì tạo, có rồi thì giữ nguyên (không đè thứ admin đã sửa).
 * - Mã giảm giá và blog: chỉ tạo ở lần cài đầu tiên (đánh dấu bằng settings `seed`),
 *   nên admin xoá hay sửa về sau cũng không bị tạo lại.
 */
export async function ensureBaseData(db: Db, now = new Date()): Promise<{ created: string[] }> {
  return withTransaction(db, async (tx) => {
    const created: string[] = [];
    const rows = await tx
      .select({ name: settings.name })
      .from(settings)
      .where(inArray(settings.name, ['shop', 'bot', 'seed']))
      .for('update');
    const existing = new Set(rows.map((row) => row.name));

    if (!existing.has('shop')) {
      await tx.insert(settings).values({ name: 'shop', value: INITIAL_SHOP_SETTINGS });
      created.push('settings.shop');
    }
    if (!existing.has('bot')) {
      await tx.insert(settings).values({ name: 'bot', value: INITIAL_BOT_SETTINGS });
      created.push('settings.bot');
    }
    if (existing.has('seed')) return { created };

    await tx
      .insert(coupons)
      .values(
        DEFAULT_COUPONS.map((template) => ({
          code: template.code.toUpperCase(),
          label: template.label,
          type: template.type,
          value: template.value,
          minSubtotal: template.minSubtotal,
          maxDiscount: template.maxDiscount ?? null,
          expiresAt: new Date(now.getTime() + template.validDays * DAY),
          firstOrderOnly: template.firstOrderOnly ?? false,
        })),
      )
      .onDuplicateKeyUpdate({ set: { code: sql`${coupons.code}` } });
    await tx
      .insert(blogPosts)
      .values(
        INITIAL_BLOG_POSTS.map((post) => ({
          id: newId(),
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          coverImage: post.coverImage,
          category: post.category,
          tags: post.tags,
          authorName: post.authorName,
          publishedAt: new Date(post.publishedAt),
          readingMinutes: post.readingMinutes,
          viewCount: 0,
          sections: post.sections,
        })),
      )
      .onDuplicateKeyUpdate({ set: { slug: sql`${blogPosts.slug}` } });
    await tx
      .insert(settings)
      .values({ name: 'seed', value: { version: SEED_VERSION, at: now.toISOString() } });
    created.push('coupons', 'blog_posts');
    return { created };
  });
}

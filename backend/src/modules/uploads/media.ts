import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { auctions, blogPosts, feeds, items, media, orderItems } from '../../db/schema';
import { withTransaction, type Tx } from '../../db/tx';
import { unprocessable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';

/*
 * Vòng đời file ảnh / video trên ổ mini PC (bảng `media`):
 * 1. Tải lên: ghi file + dòng media (in_use = false).
 * 2. Lưu feed / con Bakugan: mọi URL phải có trong media, đúng loại (`claimMedia`), rồi in_use = true.
 *    Nhờ vậy không ai chèn được link lạ vào trang của shop.
 * 3. URL bị thay / bỏ: sau khi lưu xong, chỗ nào cũng không còn dùng thì xoá dòng media
 *    và xoá file (`releaseMedia`).
 * 4. File tải lên mà không dùng tới: việc chạy nền dọn sau 24 giờ (giai đoạn 4–5).
 */

export const MEDIA_MISSING_MESSAGE =
  'Có ảnh / video không còn trên máy của shop (hoặc không phải file tải lên từ trang quản trị). Tải lại file đó nhé.';

export interface MediaRefs {
  images: readonly string[];
  videos: readonly string[];
}

/** Gom URL, bỏ trùng và bỏ ô trống. */
export function uniqueUrls(urls: Iterable<string | null | undefined>): string[] {
  return [...new Set([...urls].filter((url): url is string => Boolean(url)))];
}

/**
 * Kiểm tra mọi URL là file đã tải lên (đúng ảnh / video) và đánh dấu đang dùng.
 * Khoá các dòng media tới hết transaction, để việc dọn file chạy song song không xoá mất.
 */
export async function claimMedia(tx: Tx, refs: MediaRefs): Promise<void> {
  const urls = uniqueUrls([...refs.images, ...refs.videos]);
  if (urls.length === 0) return;
  const rows = await tx
    .select({ url: media.url, kind: media.kind })
    .from(media)
    .where(inArray(media.url, urls))
    .for('update');
  const kindOf = new Map(rows.map((row) => [row.url, row.kind]));
  const wrong =
    refs.images.some((url) => kindOf.get(url) !== 'image') ||
    refs.videos.some((url) => kindOf.get(url) !== 'video');
  if (wrong) throw unprocessable(MEDIA_MISSING_MESSAGE);
  await tx
    .update(media)
    .set({ inUse: true })
    .where(and(inArray(media.url, urls), eq(media.inUse, false)));
}

/** URL này còn được dùng ở đâu không (feed đang có, con Bakugan, đơn đã mua, đấu giá, blog). */
async function stillUsed(tx: Tx, url: string): Promise<boolean> {
  const [rows] = await tx.execute(sql`
    SELECT (
      EXISTS (SELECT 1 FROM ${feeds} WHERE ${feeds.retiredAt} IS NULL AND ${url} MEMBER OF (${feeds.images}))
      OR EXISTS (SELECT 1 FROM ${items} WHERE ${url} MEMBER OF (${items.photos}) OR ${items.video} = ${url})
      OR EXISTS (SELECT 1 FROM ${orderItems} WHERE ${orderItems.image} = ${url})
      OR EXISTS (SELECT 1 FROM ${auctions} WHERE ${url} MEMBER OF (${auctions.images}))
      OR EXISTS (SELECT 1 FROM ${blogPosts} WHERE ${blogPosts.coverImage} = ${url})
    ) AS used`);
  return Number((rows as unknown as Array<{ used: number | string }>)[0]?.used ?? 0) === 1;
}

/** Đường dẫn thật trên ổ của một dòng media; không cho thoát ra ngoài thư mục tải lên. */
export function mediaFilePath(uploadDir: string, relativePath: string): string | undefined {
  const full = path.resolve(uploadDir, relativePath);
  return full.startsWith(path.resolve(uploadDir) + path.sep) ? full : undefined;
}

/**
 * Gọi SAU khi transaction lưu feed / con đã thành công, với các URL vừa bị thay hoặc bỏ.
 * URL nào không còn dùng ở đâu thì xoá dòng media rồi xoá file. Lỗi chỉ ghi log
 * (việc lưu của admin đã xong; file sót lại thì việc chạy nền dọn sau).
 */
export async function releaseMedia(
  db: Db,
  uploadDir: string,
  urls: Iterable<string>,
  logger: Logger,
): Promise<void> {
  const candidates = uniqueUrls(urls);
  if (candidates.length === 0) return;
  try {
    const removed = await withTransaction(db, async (tx) => {
      const rows = await tx
        .select({ id: media.id, url: media.url, path: media.path })
        .from(media)
        .where(inArray(media.url, candidates))
        .for('update');
      const unused: typeof rows = [];
      for (const row of rows) {
        if (!(await stillUsed(tx, row.url))) unused.push(row);
      }
      if (unused.length > 0) {
        await tx.delete(media).where(
          inArray(
            media.id,
            unused.map((row) => row.id),
          ),
        );
      }
      return unused;
    });
    for (const row of removed) {
      const file = mediaFilePath(uploadDir, row.path);
      if (!file) continue;
      await unlink(file).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT')
          logger.warn({ err: error, path: row.path }, 'Không xoá được file');
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Không dọn được ảnh / video không còn dùng');
  }
}

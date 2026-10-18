import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { fileTypeFromFile } from 'file-type';
import multer from 'multer';
import sharp from 'sharp';
import type { Db } from '../../db/client';
import { media } from '../../db/schema';
import { ApiError, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { requireAdmin } from '../../middleware/auth';

/*
 * POST /api/admin/uploads — admin tải ảnh / video lên ổ của mini PC (form gồm `file` + `kind`).
 * - Không tin đuôi file hay Content-Type: đọc vài byte đầu để biết đúng là ảnh / video.
 * - Ảnh: xoay đúng chiều, thu cạnh dài về 1600 px, xuất WebP, xoá mọi thông tin ẩn (EXIF, GPS).
 * - Video: giữ nguyên file (MP4 / MOV / WebM), ghi thẳng xuống ổ, không giữ trong RAM.
 * - Tên file ngẫu nhiên, không bao giờ trùng hay ghi đè. Trả về { url: "/uploads/…" }.
 */

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Cạnh dài tối đa sau khi thu nhỏ — đủ nét để khách phóng to xem từng con */
const MAX_EDGE = 1600;
const WEBP_QUALITY = 82;
/** Ảnh quá nhiều điểm ảnh (ảnh "bom" nén nhỏ nhưng giải nén ra cực lớn) thì từ chối */
const MAX_INPUT_PIXELS = 100_000_000;

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);
const VIDEO_TYPES = new Map([
  ['video/mp4', 'mp4'],
  ['video/x-m4v', 'm4v'],
  ['video/quicktime', 'mov'],
  ['video/webm', 'webm'],
]);

/** Thư mục tạm nằm trong thư mục tải lên (cùng ổ nên chuyển file chỉ là đổi tên) */
const TMP_DIR = '.tmp';

// Máy nhỏ: không giữ bộ đệm ảnh của sharp trong RAM.
sharp.cache(false);

export interface UploadDeps {
  db: Db;
  uploadDir: string;
  logger: Logger;
}

/** Chạy multer như một lời hứa để tự đổi lỗi của multer thành câu dễ hiểu. */
function receiveFile(handler: RequestHandler, req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    handler(req, res, (error?: unknown) => {
      if (!error) {
        resolve();
        return;
      }
      if (error instanceof multer.MulterError) {
        reject(
          error.code === 'LIMIT_FILE_SIZE'
            ? new ApiError(413, 'File quá lớn (ảnh tối đa 15 MB, video tối đa 100 MB).')
            : new ApiError(400, 'Dữ liệu tải lên không hợp lệ: mỗi lần gửi đúng một file.'),
        );
        return;
      }
      reject(error);
    });
  });
}

async function sha256OfFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

/** img/2026/10/<id>.webp — theo tháng để mỗi thư mục không quá nhiều file */
function relativePathFor(folder: 'img' | 'video', extension: string, now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${folder}/${now.getUTCFullYear()}/${month}/${newId()}.${extension}`;
}

/** Dọn file tạm sót lại (server tắt giữa chừng lúc đang nhận file). */
async function cleanStaleTemp(tmpDir: string, logger: Logger): Promise<void> {
  try {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const name of await readdir(tmpDir)) {
      const file = path.join(tmpDir, name);
      const info = await stat(file);
      if (info.mtimeMs < cutoff) await rm(file, { force: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ err: error }, 'Không dọn được thư mục tạm của ảnh tải lên');
    }
  }
}

export function uploadsRouter({ db, uploadDir, logger }: UploadDeps): Router {
  const tmpDir = path.join(uploadDir, TMP_DIR);
  void cleanStaleTemp(tmpDir, logger);
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, done) => {
        mkdir(tmpDir, { recursive: true }).then(
          () => done(null, tmpDir),
          (error: Error) => done(error, tmpDir),
        );
      },
      filename: (_req, _file, done) => done(null, newId()),
    }),
    limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 4, fieldSize: 200, parts: 6 },
  }).single('file');

  const router = Router();
  // Kiểm tra quyền TRƯỚC khi nhận file, để người lạ không ghi được gì xuống ổ.
  router.use(requireAdmin);

  router.post('/', async (req, res) => {
    await receiveFile(upload, req, res);
    const file = req.file;
    const finals: string[] = [];
    try {
      if (!file) throw unprocessable('Chưa chọn file để tải lên.');
      const kind = (req.body as { kind?: unknown } | undefined)?.kind ?? 'image';
      if (kind !== 'image' && kind !== 'video') throw unprocessable('Loại file không hợp lệ.');
      const detected = await fileTypeFromFile(file.path);

      let relative: string;
      let mime: string;
      let width: number | null = null;
      let height: number | null = null;
      if (kind === 'image') {
        if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'Ảnh quá lớn (tối đa 15 MB).');
        if (!detected || !IMAGE_TYPES.has(detected.mime)) {
          throw unprocessable('File này không phải ảnh (nhận JPEG, PNG, WebP, AVIF, HEIC).');
        }
        relative = relativePathFor('img', 'webp');
        const target = path.join(uploadDir, relative);
        await mkdir(path.dirname(target), { recursive: true });
        finals.push(target);
        try {
          const info = await sharp(file.path, { limitInputPixels: MAX_INPUT_PIXELS })
            .rotate()
            .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toFile(target);
          width = info.width;
          height = info.height;
        } catch (error) {
          logger.warn({ err: error, mime: detected.mime }, 'Không đọc được ảnh tải lên');
          throw unprocessable(
            'Không đọc được ảnh này. Thử chụp lại hoặc lưu sang JPEG / PNG rồi tải lên.',
          );
        }
        mime = 'image/webp';
      } else {
        const extension = detected ? VIDEO_TYPES.get(detected.mime) : undefined;
        if (!detected || !extension) {
          throw unprocessable('File này không phải video (nhận MP4, MOV, WebM).');
        }
        relative = relativePathFor('video', extension);
        const target = path.join(uploadDir, relative);
        await mkdir(path.dirname(target), { recursive: true });
        await rename(file.path, target);
        finals.push(target);
        mime = detected.mime;
      }

      const target = finals[0]!;
      const bytes = (await stat(target)).size;
      const url = `/uploads/${relative}`;
      await db.insert(media).values({
        id: newId(),
        path: relative,
        url,
        kind,
        mime,
        bytes,
        width,
        height,
        sha256: await sha256OfFile(target),
        uploadedBy: req.auth?.user.id ?? null,
        inUse: false,
      });
      finals.length = 0;
      res.status(201).json({ data: { url } });
    } finally {
      if (file) await unlink(file.path).catch(() => undefined);
      // Lỗi giữa chừng: không để lại file không có dòng media.
      for (const target of finals) await unlink(target).catch(() => undefined);
    }
  });

  return router;
}

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { media } from '../../src/db/schema';
import { openTestDatabase, signInAs, testApp, testEnv } from '../helpers';

let database: Database;
let uploadDir: string;
let app: ReturnType<typeof testApp>;
let admin: { Authorization: string };

beforeAll(async () => {
  uploadDir = mkdtempSync(path.join(tmpdir(), 'tdb-uploads-'));
  database = await openTestDatabase();
  app = testApp(database, { env: testEnv({ UPLOAD_DIR: uploadDir }) });
  admin = (await signInAs(app, database, 'admin')).auth;
});

afterAll(async () => {
  await database.close();
  rmSync(uploadDir, { recursive: true, force: true });
});

function send(file: Buffer, filename: string, contentType: string, kind = 'image') {
  return request(app)
    .post('/api/admin/uploads')
    .set(admin)
    .attach('file', file, { filename, contentType })
    .field('kind', kind);
}

/** File trên ổ ngoài thư mục tạm (để chắc lần tải lỗi không để lại gì) */
function storedFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.relative(uploadDir, path.join(dir, entry.name))],
    );
  return existsSync(uploadDir) ? walk(uploadDir) : [];
}

describe('tải ảnh', () => {
  it('ảnh điện thoại: xoay đúng chiều, thu về 1600 px, đổi sang WebP, xoá EXIF / GPS', async () => {
    // Ảnh ngang 2400×1200 nhưng điện thoại ghi "xoay 90°" trong EXIF, kèm thông tin máy chụp.
    const photo = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: '#3a6' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: 'PhoneCo', Model: 'Camera X', Artist: 'Nguoi chup' } })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const res = await send(photo, 'IMG_0001.JPG', 'image/jpeg').expect(201);
    const url = res.body.data.url as string;
    expect(url).toMatch(/^\/uploads\/img\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);

    const file = path.join(uploadDir, url.slice('/uploads/'.length));
    const stored = await sharp(file).metadata();
    expect(stored).toMatchObject({ format: 'webp', width: 800, height: 1600 });
    expect(stored.exif).toBeUndefined();
    expect(stored.orientation).toBeUndefined();

    const [row] = await database.db.select().from(media).where(eq(media.url, url));
    expect(row).toMatchObject({ kind: 'image', mime: 'image/webp', width: 800, height: 1600 });
    expect(row?.inUse).toBe(false);
    expect(row?.sha256).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));

    // Khi lập trình, backend tự trả file (trên mini PC thì Caddy trả) với header an toàn.
    const served = await request(app).get(url).expect(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['cache-control']).toContain('immutable');
    expect(served.headers['content-security-policy']).toContain('sandbox');
  });

  it('không tin đuôi file: chữ đổi tên thành .png, SVG, video gửi như ảnh → 422, không để lại file', async () => {
    const before = storedFiles();
    const fake = await send(Buffer.from('không phải ảnh đâu'), 'anh.png', 'image/png').expect(422);
    expect(fake.body.message).toBe('File này không phải ảnh (nhận JPEG, PNG, WebP, AVIF, HEIC).');
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await send(svg, 'logo.svg', 'image/svg+xml').expect(422);
    const mp4 = Buffer.from('00000018667479706973' + '6f6d0000020069736f6d6d703431', 'hex');
    await send(mp4, 'video.png', 'image/png').expect(422);
    expect(storedFiles()).toEqual(before);
  });

  it('ảnh hỏng (đầu file PNG nhưng nội dung lỗi) → 422 kèm hướng dẫn', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    const broken = Buffer.concat([png.subarray(0, 40), Buffer.alloc(200, 1)]);
    const res = await send(broken, 'hong.png', 'image/png').expect(422);
    expect(res.body.message).toContain('Không đọc được ảnh này');
  });

  it('ảnh quá 15 MB → 413; thiếu file → 422; loại lạ → 422', async () => {
    const huge = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(15 * 1024 * 1024),
    ]);
    const big = await send(huge, 'to.jpg', 'image/jpeg').expect(413);
    expect(big.body.message).toBe('Ảnh quá lớn (tối đa 15 MB).');
    await request(app).post('/api/admin/uploads').set(admin).field('kind', 'image').expect(422);
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    await send(png, 'a.png', 'image/png', 'pdf').expect(422);
    expect(readdirSync(path.join(uploadDir, '.tmp'))).toEqual([]);
  });
});

describe('tải video', () => {
  const MP4 = Buffer.concat([
    Buffer.from('00000018' + '66747970' + '69736f6d' + '00000200' + '69736f6d6d703431', 'hex'),
    Buffer.alloc(4096, 7),
  ]);

  it('giữ nguyên file MP4, lưu vào video/…, ghi media', async () => {
    const res = await send(MP4, 'clip.mp4', 'video/mp4', 'video').expect(201);
    const url = res.body.data.url as string;
    expect(url).toMatch(/^\/uploads\/video\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.mp4$/);
    const file = path.join(uploadDir, url.slice('/uploads/'.length));
    expect(readFileSync(file).equals(MP4)).toBe(true);
    const [row] = await database.db.select().from(media).where(eq(media.url, url));
    expect(row).toMatchObject({ kind: 'video', mime: 'video/mp4', bytes: MP4.length });
  });

  it('ảnh gửi như video → 422', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const res = await send(png, 'clip.mp4', 'video/mp4', 'video').expect(422);
    expect(res.body.message).toBe('File này không phải video (nhận MP4, MOV, WebM).');
  });
});

describe('đường /uploads', () => {
  it('không lộ thư mục tạm, file ẩn hay file ngoài thư mục tải lên', async () => {
    await request(app)
      .get('/uploads/.tmp/abc')
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
    await request(app)
      .get('/uploads/..%2f..%2fetc%2fpasswd')
      .expect((res) => {
        expect([400, 403, 404]).toContain(res.status);
      });
    await request(app).get('/uploads/img/khong-co.webp').expect(404);
  });
});

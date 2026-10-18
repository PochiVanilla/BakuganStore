import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { auditLogs, feeds, items, media } from '../../src/db/schema';
import { MEDIA_MISSING_MESSAGE } from '../../src/modules/uploads/media';
import { FEED_LIMIT } from '../../src/shared/types';
import { openTestDatabase, signInAs, testApp, testEnv } from '../helpers';

let database: Database;
let uploadDir: string;
let app: ReturnType<typeof testApp>;
let admin: { Authorization: string };
let customer: { Authorization: string };

beforeAll(async () => {
  uploadDir = mkdtempSync(path.join(tmpdir(), 'tdb-catalog-'));
  database = await openTestDatabase();
  app = testApp(database, { env: testEnv({ UPLOAD_DIR: uploadDir }) });
  admin = (await signInAs(app, database, 'admin')).auth;
  customer = (await signInAs(app, database, 'customer')).auth;
});

afterAll(async () => {
  await database.close();
  rmSync(uploadDir, { recursive: true, force: true });
});

async function uploadImage(color = '#c33'): Promise<string> {
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: color } })
    .png()
    .toBuffer();
  const res = await request(app)
    .post('/api/admin/uploads')
    .set(admin)
    .attach('file', png, { filename: 'anh.png', contentType: 'image/png' })
    .field('kind', 'image')
    .expect(201);
  return res.body.data.url as string;
}

/** Đầu file MP4 tối thiểu (hộp "ftyp", nhãn isom) — đủ để nhận ra đúng là video */
const MP4_HEADER = Buffer.from(
  '00000018' + '66747970' + '69736f6d' + '00000200' + '69736f6d6d703431',
  'hex',
);

async function uploadVideo(): Promise<string> {
  const res = await request(app)
    .post('/api/admin/uploads')
    .set(admin)
    .attach('file', Buffer.concat([MP4_HEADER, Buffer.alloc(2048)]), {
      filename: 'gioi-thieu.mp4',
      contentType: 'video/mp4',
    })
    .field('kind', 'video')
    .expect(201);
  return res.body.data.url as string;
}

function fileOf(url: string): string {
  return path.join(uploadDir, url.replace(/^\/uploads\//, ''));
}

function item(overrides: Record<string, unknown> = {}) {
  return { name: 'Dragonoid Pyrus', price: 250_000, attribute: 'Pyrus', ...overrides };
}

function feedBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Lô Bakugan Nhật về tháng 10',
    caption: 'Hàng tuyển, ảnh thật.',
    images: [],
    supplier: 'Anh Tuấn',
    lotCost: 1_500_000,
    items: [item()],
    ...overrides,
  };
}

async function postFeed(body: Record<string, unknown>, status = 201) {
  return request(app).post('/api/admin/feeds').set(admin).send(body).expect(status);
}

describe('quyền', () => {
  it('chưa đăng nhập → 401; tài khoản khách → 403 ở mọi API quản trị', async () => {
    await request(app).get('/api/admin/feeds').expect(401);
    for (const url of ['/api/admin/feeds', '/api/admin/items', '/api/admin/feeds/limit']) {
      await request(app).get(url).set(customer).expect(403);
    }
    await request(app).post('/api/admin/feeds').set(customer).send(feedBody()).expect(403);
    await request(app)
      .post('/api/admin/uploads')
      .set(customer)
      .attach('file', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' })
      .expect(403);
    // Bị chặn trước khi nhận file: không có gì được ghi xuống ổ.
    expect(existsSync(path.join(uploadDir, '.tmp'))).toBe(false);
  });

  it('khách xem feed không cần đăng nhập', async () => {
    const res = await request(app).get('/api/feeds').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('đăng feed và khách xem', () => {
  let feedNumber: number;

  it('cấp số feed, mã BK tự động / tự gõ, nhận ra hệ, giữ đúng thứ tự', async () => {
    const cover = await uploadImage('#28a');
    const photo = await uploadImage('#a82');
    const video = await uploadVideo();
    const res = await postFeed(
      feedBody({
        images: [cover],
        items: [
          item({ name: 'Rồng Dragonoid', photos: [photo], video, condition: '  Like new  ' }),
          item({ name: 'Preyas Aquos', attribute: 'Hệ Nước', code: ' bk 77 ', price: 180_000 }),
          item({ name: 'Con lạ', attribute: 'Hệ Vũ Trụ', series: 'new-vestroia', price: 90_000 }),
        ],
      }),
    );
    const feed = res.body.data;
    feedNumber = feed.number;
    expect(feed.number).toBe(1);
    expect(feed.status).toBe('selling');
    expect(feed.items.map((entry: { code: string }) => entry.code)).toEqual([
      'BK-0001',
      'BK-0077',
      'BK-0002',
    ]);
    expect(feed.items[0]).toMatchObject({
      name: 'Rồng Dragonoid',
      condition: 'Like new',
      images: [photo],
      image: photo,
      video,
      onSale: true,
    });
    expect(feed).toMatchObject({ lotCost: 1_500_000, supplier: 'Anh Tuấn', revenue: 0 });
    expect(feed.priceRange).toEqual({ min: 90_000, max: 250_000 });

    const rows = await database.db.select().from(items).where(eq(items.feedId, feed.id));
    const byCode = new Map(rows.map((row) => [row.code, row]));
    expect(byCode.get('BK-0001')?.attributeKey).toBe('pyrus');
    expect(byCode.get('BK-0077')?.attributeKey).toBe('aquos');
    expect(byCode.get('BK-0002')?.attributeKey).toBeNull();
    expect(byCode.get('BK-0001')?.searchText).toBe('rong dragonoid bk-0001 bk0001');
    // Ảnh / video đã dùng được đánh dấu để việc dọn file không xoá nhầm.
    const used = await database.db.select().from(media).where(eq(media.url, photo));
    expect(used[0]?.inUse).toBe(true);

    const audit = await database.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'feed.create'), eq(auditLogs.targetId, feed.id)));
    expect(audit[0]).toMatchObject({ actorName: 'Chủ shop', targetType: 'feed' });
  });

  it('bản cho khách không lộ giá nhập, nhà cung cấp, người mua', async () => {
    const res = await request(app).get(`/api/feeds/${feedNumber}`).expect(200);
    expect(res.body.data).not.toHaveProperty('lotCost');
    expect(res.body.data).not.toHaveProperty('supplier');
    expect(res.body.data).not.toHaveProperty('revenue');
    expect(res.body.data.items[0]).not.toHaveProperty('buyerName');
    expect(res.body.data.items[0]).not.toHaveProperty('soldVia');
    await request(app).get('/api/feeds/9999').expect(404);
    await request(app).get('/api/feeds/abc').expect(404);
  });

  it('tìm theo tên không dấu, mã viết liền, hệ, khoảng giá; gợi ý ở ô tìm kiếm', async () => {
    const byName = await request(app).get('/api/feeds/items').query({ keyword: 'rong' });
    expect(byName.body.data.map((entry: { code: string }) => entry.code)).toEqual(['BK-0001']);

    const byCode = await request(app).get('/api/feeds/items/bk77').expect(200);
    expect(byCode.body.data.item.name).toBe('Preyas Aquos');
    expect(byCode.body.data.feed.number).toBe(feedNumber);

    const byAttribute = await request(app).get(
      '/api/feeds/items?attributes[]=aquos&attributes[]=pyrus',
    );
    expect(byAttribute.body.data).toHaveLength(2);
    const byPrice = await request(app)
      .get('/api/feeds/items')
      .query({ minPrice: 100_000, maxPrice: 200_000 });
    expect(byPrice.body.data.map((entry: { code: string }) => entry.code)).toEqual(['BK-0077']);

    const feedsByAttribute = await request(app).get('/api/feeds').query({ attribute: 'aquos' });
    expect(feedsByAttribute.body.data).toHaveLength(1);
    const feedsByTitle = await request(app).get('/api/feeds').query({ keyword: 'lo bakugan nhat' });
    expect(feedsByTitle.body.data).toHaveLength(1);

    const suggestions = await request(app).get('/api/feeds/suggestions').query({ keyword: 'dra' });
    expect(suggestions.body.data.items.map((entry: { code: string }) => entry.code)).toEqual([
      'BK-0001',
    ]);
    const short = await request(app).get('/api/feeds/suggestions').query({ keyword: 'd' });
    expect(short.body.data).toEqual({ items: [], feeds: [] });

    await request(app)
      .get('/api/feeds/items')
      .query({ attributes: ['lua'] })
      .expect(422);
  });

  it('by-ids trả trạng thái mới nhất của các con trong giỏ', async () => {
    const all = await request(app).get('/api/feeds/items').query({ includeSold: true });
    const ids = all.body.data.slice(0, 2).map((entry: { id: string }) => entry.id);
    const res = await request(app)
      .get('/api/feeds/items/by-ids')
      .query({ ids: [...ids, 'khong-co'].join(',') })
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    const empty = await request(app).get('/api/feeds/items/by-ids').expect(200);
    expect(empty.body.data).toEqual([]);
  });

  it('feed hẹn giờ mở bán: "sắp mở bán", chưa đặt mua được', async () => {
    const opensAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const res = await postFeed(
      feedBody({ title: 'Lô hẹn giờ', opensAt, items: [item({ name: 'Tigrerra Haos' })] }),
    );
    expect(res.body.data.status).toBe('upcoming');
    const upcoming = await request(app).get('/api/feeds').query({ status: 'upcoming' });
    expect(upcoming.body.data.map((feed: { title: string }) => feed.title)).toEqual(['Lô hẹn giờ']);
    expect(upcoming.body.data[0].items[0].onSale).toBe(false);
    expect(upcoming.body.data[0].items[0].feedOpensAt).toBe(opensAt);
  });
});

describe('kiểm tra dữ liệu', () => {
  it('báo đúng ô / đúng con như web', async () => {
    const short = await postFeed(feedBody({ title: 'ab' }), 422);
    expect(short.body.fieldErrors).toEqual({ title: 'Tiêu đề feed cần ít nhất 3 ký tự.' });
    const price = await postFeed(feedBody({ items: [item(), item({ price: 12.5 })] }), 422);
    expect(price.body.message).toBe('Con thứ 2: giá không hợp lệ.');
    const code = await postFeed(feedBody({ items: [item({ code: 'XY-12' })] }), 422);
    expect(code.body.message).toBe('Con thứ 1: mã "XY-12" không đúng dạng BK-0123.');
    const empty = await postFeed(feedBody({ items: [] }), 422);
    expect(empty.body.fieldErrors).toEqual({ items: 'Feed cần ít nhất một con Bakugan.' });
    const attribute = await postFeed(feedBody({ items: [item({ attribute: '   ' })] }), 422);
    expect(attribute.body.message).toBe('Con thứ 1: chưa ghi hệ.');
    const wrongType = await postFeed(feedBody({ items: 'abc' }), 422);
    expect(wrongType.body.fieldErrors).toHaveProperty('items');
  });

  it('chỉ nhận ảnh / video đã tải lên máy shop, đúng loại', async () => {
    const outside = await postFeed(feedBody({ images: ['https://la.example/anh.png'] }), 422);
    expect(outside.body.message).toBe(MEDIA_MISSING_MESSAGE);
    const video = await uploadVideo();
    const wrongKind = await postFeed(feedBody({ items: [item({ photos: [video] })] }), 422);
    expect(wrongKind.body.message).toBe(MEDIA_MISSING_MESSAGE);
    const image = await uploadImage();
    const imageAsVideo = await postFeed(feedBody({ items: [item({ video: image })] }), 422);
    expect(imageAsVideo.body.message).toBe(MEDIA_MISSING_MESSAGE);
  });

  it('mã tự gõ trùng con khác (kể cả trong cùng feed) → 409', async () => {
    const taken = await postFeed(feedBody({ items: [item({ code: 'BK-0077' })] }), 409);
    expect(taken.body.message).toBe('Mã BK-0077 đã có con khác dùng. Đổi mã khác nhé.');
    const twice = await postFeed(
      feedBody({ items: [item({ code: 'bk500' }), item({ code: 'BK-0500' })] }),
      409,
    );
    expect(twice.body.message).toBe('Mã BK-0500 đã có con khác dùng. Đổi mã khác nhé.');
    // Lần lưu lỗi không để lại gì: không có feed hay con nào được tạo dở.
    const rows = await database.db.select().from(items).where(eq(items.code, 'BK-0500'));
    expect(rows).toHaveLength(0);
  });
});

describe('sửa feed, hàng tồn, bán ngoài web', () => {
  it('đổi thứ tự, bỏ con chưa bán thành hàng tồn, con đã bán giữ giá, ảnh bị thay được xoá khỏi ổ', async () => {
    const oldCover = await uploadImage('#111');
    const created = (
      await postFeed(
        feedBody({
          title: 'Lô để sửa',
          images: [oldCover],
          items: [
            item({ name: 'Con A', price: 100_000 }),
            item({ name: 'Con B', price: 200_000 }),
            item({ name: 'Con C', price: 300_000 }),
          ],
        }),
      )
    ).body.data;
    const [a, b, c] = created.items as Array<{ id: string; code: string }>;
    await request(app)
      .post(`/api/admin/items/${a!.id}/mark-sold`)
      .set(admin)
      .send({ buyerName: 'Nguyễn Đức', note: 'Chốt qua Messenger' })
      .expect(200);

    const newCover = await uploadImage('#222');
    const res = await request(app)
      .put(`/api/admin/feeds/${created.id}`)
      .set(admin)
      .send(
        feedBody({
          title: 'Lô đã sửa',
          images: [newCover],
          items: [
            { ...item({ name: 'Con C', price: 310_000 }), id: c!.id, code: 'BK-0900' },
            { ...item({ name: 'Con A', price: 1 }), id: a!.id },
          ],
        }),
      )
      .expect(200);
    const feed = res.body.data;
    expect(feed.title).toBe('Lô đã sửa');
    expect(feed.items.map((entry: { name: string }) => entry.name)).toEqual(['Con C', 'Con A']);
    expect(feed.items[0]).toMatchObject({ code: 'BK-0900', price: 310_000 });
    // Con đã bán giữ nguyên giá; có thông tin người mua ở bản admin.
    expect(feed.items[1]).toMatchObject({
      price: 100_000,
      status: 'sold',
      soldVia: 'manual',
      buyerName: 'Nguyễn Đức',
      soldNote: 'Chốt qua Messenger',
    });
    expect(feed.revenue).toBe(100_000);

    const leftovers = await request(app).get('/api/admin/items/leftovers').set(admin).expect(200);
    const leftover = leftovers.body.data.find((entry: { id: string }) => entry.id === b!.id);
    expect(leftover).toMatchObject({ name: 'Con B', feedTitle: 'Lô đã sửa', onSale: false });
    expect(leftover.feedId).toBeUndefined();

    // Ảnh bìa cũ không còn ai dùng: xoá cả file lẫn dòng media.
    expect(existsSync(fileOf(oldCover))).toBe(false);
    expect(await database.db.select().from(media).where(eq(media.url, oldCover))).toHaveLength(0);
    expect(existsSync(fileOf(newCover))).toBe(true);

    // Khách không thấy hàng tồn; trạng thái mới hiện ngay (bộ đệm được xoá khi admin sửa).
    const publicFeed = await request(app).get(`/api/feeds/${feed.number}`).expect(200);
    expect(publicFeed.body.data.items.map((entry: { name: string }) => entry.name)).toEqual([
      'Con C',
      'Con A',
    ]);
    await request(app).get(`/api/feeds/items/${b!.code}`).expect(404);
  });

  it('đánh dấu bán / bỏ đánh dấu; bán hết thì feed "đã bán hết"', async () => {
    const created = (await postFeed(feedBody({ title: 'Lô một con' }))).body.data;
    const only = created.items[0] as { id: string; code: string };
    const sold = await request(app)
      .post(`/api/admin/items/${only.id}/mark-sold`)
      .set(admin)
      .send({})
      .expect(200);
    expect(sold.body.data).toMatchObject({ status: 'sold', soldNote: 'Bán ngoài web' });
    const again = await request(app)
      .post(`/api/admin/items/${only.id}/mark-sold`)
      .set(admin)
      .send({})
      .expect(409);
    expect(again.body.message).toBe(`${only.code} đã bán rồi.`);

    const publicFeed = (await request(app).get(`/api/feeds/${created.number}`)).body.data;
    expect(publicFeed.status).toBe('sold-out');
    expect(publicFeed.soldOutAt).toBe(sold.body.data.soldAt);
    expect(publicFeed.priceRange).toBeUndefined();

    const back = await request(app)
      .post(`/api/admin/items/${only.id}/mark-available`)
      .set(admin)
      .expect(200);
    expect(back.body.data).toMatchObject({ status: 'available', onSale: true });
    expect(back.body.data.soldNote).toBeUndefined();
    await request(app).post(`/api/admin/items/${only.id}/mark-available`).set(admin).expect(409);
    await request(app).post('/api/admin/items/khong-co/mark-sold').set(admin).send({}).expect(404);
  });

  it('sửa riêng một con: mã trùng → 409 ở ô mã; đổi ảnh thì ảnh cũ bị xoá', async () => {
    const photo = await uploadImage('#333');
    const created = (
      await postFeed(feedBody({ title: 'Lô sửa từng con', items: [item({ photos: [photo] })] }))
    ).body.data;
    const target = created.items[0] as { id: string };
    const clash = await request(app)
      .put(`/api/admin/items/${target.id}`)
      .set(admin)
      .send(item({ code: 'BK-0077' }))
      .expect(409);
    expect(clash.body.fieldErrors).toEqual({ code: 'Mã này đã có con khác dùng.' });
    const shortName = await request(app)
      .put(`/api/admin/items/${target.id}`)
      .set(admin)
      .send(item({ name: 'A' }))
      .expect(422);
    expect(shortName.body.fieldErrors).toEqual({ name: 'Tên cần ít nhất 2 ký tự.' });

    const newPhoto = await uploadImage('#444');
    const res = await request(app)
      .put(`/api/admin/items/${target.id}`)
      .set(admin)
      .send(
        item({ name: 'Dragonoid đã sửa', code: 'bk 901', photos: [newPhoto], attribute: 'Haos' }),
      )
      .expect(200);
    expect(res.body.data).toMatchObject({
      code: 'BK-0901',
      name: 'Dragonoid đã sửa',
      image: newPhoto,
    });
    expect(existsSync(fileOf(photo))).toBe(false);
    const [row] = await database.db.select().from(items).where(eq(items.id, target.id));
    expect(row).toMatchObject({
      attributeKey: 'haos',
      searchText: 'dragonoid da sua bk-0901 bk0901',
    });
  });

  it('xoá con: đã bán thì không được; chưa bán thì xoá kèm ảnh', async () => {
    const photo = await uploadImage('#555');
    const created = (
      await postFeed(
        feedBody({
          title: 'Lô xoá con',
          items: [item({ name: 'Con hỏng', photos: [photo] }), item({ name: 'Con đã bán' })],
        }),
      )
    ).body.data;
    const [broken, soldOne] = created.items as Array<{ id: string }>;
    await request(app).post(`/api/admin/items/${soldOne!.id}/mark-sold`).set(admin).send({});
    const refused = await request(app)
      .delete(`/api/admin/items/${soldOne!.id}`)
      .set(admin)
      .expect(409);
    expect(refused.body.message).toBe('Không xoá được con đã bán.');
    await request(app).delete(`/api/admin/items/${broken!.id}`).set(admin).expect(200);
    expect(existsSync(fileOf(photo))).toBe(false);
    await request(app).delete(`/api/admin/items/${broken!.id}`).set(admin).expect(404);
  });

  it('xoá feed: con chưa bán thành hàng tồn, con đã bán giữ lịch sử, ảnh lô bị xoá', async () => {
    const cover = await uploadImage('#666');
    const created = (
      await postFeed(
        feedBody({
          title: 'Lô sẽ xoá',
          images: [cover],
          items: [item({ name: 'Còn bán' }), item({ name: 'Đã bán' })],
        }),
      )
    ).body.data;
    const [, soldOne] = created.items as Array<{ id: string }>;
    await request(app).post(`/api/admin/items/${soldOne!.id}/mark-sold`).set(admin).send({});
    const res = await request(app).delete(`/api/admin/feeds/${created.id}`).set(admin).expect(200);
    expect(res.body.data).toEqual({ leftoverCount: 1 });
    expect(existsSync(fileOf(cover))).toBe(false);
    await request(app).get(`/api/feeds/${created.number}`).expect(404);
    await request(app).get(`/api/admin/feeds/${created.id}`).set(admin).expect(404);
    await request(app).delete(`/api/admin/feeds/${created.id}`).set(admin).expect(404);

    const [retired] = await database.db.select().from(feeds).where(eq(feeds.id, created.id));
    expect(retired?.retiredAt).not.toBeNull();
    const [history] = await database.db.select().from(items).where(eq(items.id, soldOne!.id));
    expect(history).toMatchObject({
      feedId: null,
      feedTitleSnapshot: 'Lô sẽ xoá',
      feedNumberSnapshot: created.number,
    });
  });
});

describe('trang Kho', () => {
  it('đếm từng nhóm, lọc, tìm không dấu theo tên / người mua, phân trang, tổng tiền đã bán', async () => {
    const all = (await request(app).get('/api/admin/items').set(admin).expect(200)).body.data;
    expect(all.counts.all).toBe(all.counts.available + all.counts.sold + all.counts.leftover);
    expect(all.counts.sold).toBeGreaterThanOrEqual(3);
    expect(all.counts.leftover).toBeGreaterThanOrEqual(2);
    expect(all.page.total).toBe(all.counts.all);
    // Mã lớn trước
    const codes = all.page.items.map((entry: { code: string }) => entry.code);
    expect([...codes].sort().reverse()).toEqual(codes);

    const sold = (await request(app).get('/api/admin/items').query({ status: 'sold' }).set(admin))
      .body.data;
    expect(sold.page.items.every((entry: { status: string }) => entry.status === 'sold')).toBe(
      true,
    );
    expect(sold.soldValue).toBe(
      sold.page.items.reduce((total: number, entry: { price: number }) => total + entry.price, 0),
    );

    const buyer = (await request(app).get('/api/admin/items').query({ keyword: 'duc' }).set(admin))
      .body.data;
    expect(buyer.page.items.map((entry: { name: string }) => entry.name)).toEqual(['Con A']);
    const byFeedTitle = (
      await request(app).get('/api/admin/items').query({ keyword: 'lo se xoa' }).set(admin)
    ).body.data;
    expect(byFeedTitle.counts.all).toBe(2);

    const paged = (
      await request(app).get('/api/admin/items').query({ pageSize: 2, page: 2 }).set(admin)
    ).body.data;
    expect(paged.page).toMatchObject({ page: 2, pageSize: 2, total: all.counts.all });
    expect(paged.page.items).toHaveLength(2);
    expect(paged.page.items[0].code).toBe(codes[2]);

    const aquos = (
      await request(app).get('/api/admin/items').query({ attribute: 'aquos' }).set(admin)
    ).body.data;
    expect(aquos.page.items.map((entry: { code: string }) => entry.code)).toEqual(['BK-0077']);

    const sellable = (
      await request(app).get('/api/admin/items/sellable').query({ keyword: 'bk0077' }).set(admin)
    ).body.data;
    expect(sellable.map((entry: { code: string }) => entry.code)).toEqual(['BK-0077']);

    await request(app).get('/api/admin/items').query({ status: 'xyz' }).set(admin).expect(422);
  });

  it('gợi ý mã kế tiếp bỏ qua mã đã có', async () => {
    const res = await request(app)
      .get('/api/admin/items/next-codes')
      .query({ count: 3 })
      .set(admin)
      .expect(200);
    const taken = new Set(
      (await database.db.select({ code: items.code }).from(items)).map((row) => row.code),
    );
    expect(res.body.data).toHaveLength(3);
    for (const code of res.body.data as string[]) expect(taken.has(code)).toBe(false);
  });
});

describe('đăng cùng lúc', () => {
  it('nhiều lần đăng chen nhau vẫn ra số feed và mã BK khác nhau', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        postFeed(
          feedBody({
            title: `Lô song song ${index}`,
            items: [item(), item({ name: 'Con thứ hai' })],
          }),
        ),
      ),
    );
    const numbers = results.map((res) => res.body.data.number as number);
    expect(new Set(numbers).size).toBe(5);
    const codes = results.flatMap((res) =>
      res.body.data.items.map((entry: { code: string }) => entry.code),
    );
    expect(new Set(codes).size).toBe(10);
  });
});

describe(`giới hạn ${FEED_LIMIT} feed`, () => {
  it('đủ feed thì phải xác nhận xoá feed cũ nhất; mang hàng tồn sang feed mới', async () => {
    let check = (await request(app).get('/api/admin/feeds/limit').set(admin)).body.data;
    while (check.feedCount < FEED_LIMIT) {
      await postFeed(feedBody({ title: `Lô lấp chỗ ${check.feedCount}` }));
      check = (await request(app).get('/api/admin/feeds/limit').set(admin)).body.data;
    }
    expect(check.oldest).toMatchObject({ number: 1, itemCount: 3, soldCount: 0 });
    expect(check.oldest.leftovers.map((entry: { code: string }) => entry.code)).toEqual([
      'BK-0001',
      'BK-0077',
      'BK-0002',
    ]);

    const refused = await postFeed(feedBody({ title: 'Lô thứ 31' }), 409);
    expect(refused.body.message).toBe(
      `Web đã có ${FEED_LIMIT}/${FEED_LIMIT} feed. Cần xác nhận xoá feed cũ nhất trước khi đăng feed mới.`,
    );
    await postFeed(feedBody({ title: 'Lô thứ 31', replaceFeedId: 'sai-id' }), 409);

    const res = await postFeed(
      feedBody({
        title: 'Lô thứ 31',
        items: [],
        replaceFeedId: check.oldest.id,
        carryLeftovers: true,
      }),
    );
    expect(res.body.data.items.map((entry: { code: string }) => entry.code)).toEqual([
      'BK-0001',
      'BK-0077',
      'BK-0002',
    ]);
    const list = (await request(app).get('/api/admin/feeds').set(admin)).body.data;
    expect(list.feeds).toHaveLength(FEED_LIMIT);
    expect(list.limit).toBe(FEED_LIMIT);
    expect(list.feeds.some((feed: { number: number }) => feed.number === 1)).toBe(false);
    expect(list.counts.all).toBe(FEED_LIMIT);
    await request(app).get('/api/feeds/1').expect(404);
  });
});

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../src/db/client';
import type { ChatBotHandlers } from '../../src/modules/bot/routes';
import { openTestDatabase, TEST_ORIGIN, testApp, testEnv } from '../helpers';

const okBot: ChatBotHandlers = {
  status: () => Response.json({ configured: true }),
  reply: () => Response.json({ reply: 'ok', handoff: false }),
};

let database: Database;

beforeAll(async () => {
  database = await openTestDatabase();
});
afterAll(async () => {
  await database.close();
});

describe('khung API', () => {
  it('GET /api/health: CSDL trả lời thì 200', async () => {
    const res = await request(testApp(database)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /api/health: CSDL không trả lời thì 503, không lộ chi tiết', async () => {
    const env = testEnv({ DB_HOST: '127.0.0.1', DB_PORT: '1' });
    const broken = createDatabase(env);
    try {
      const res = await request(testApp(broken, { env })).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    } finally {
      await broken.close();
    }
  });

  it('đường dẫn lạ trả 404 dạng JSON; không có header X-Powered-By; có header an toàn', async () => {
    const res = await request(testApp(database)).get('/api/khong-co');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Không tìm thấy đường dẫn này.' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('mã request: nhận lại mã hợp lệ, thay mã không hợp lệ', async () => {
    const app = testApp(database);
    const kept = await request(app).get('/api/health').set('X-Request-Id', 'caddy-req-12345678');
    expect(kept.headers['x-request-id']).toBe('caddy-req-12345678');
    const replaced = await request(app).get('/api/health').set('X-Request-Id', 'bad id <script>');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('JSON hỏng → 400; body quá 100 KB → 413 (câu tiếng Việt, không lộ lỗi kỹ thuật)', async () => {
    const app = testApp(database);
    const broken = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(broken.status).toBe(400);
    expect(broken.body).toEqual({ message: 'Dữ liệu gửi lên không đúng định dạng.' });
    const huge = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(150_000) }));
    expect(huge.status).toBe(413);
    expect(huge.body).toEqual({ message: 'Dữ liệu gửi lên quá lớn.' });
  });

  describe('chặn trang lạ gọi API (Origin)', () => {
    const post = (origin?: string, host?: string) => {
      const req = request(testApp(database, { chatBot: okBot }))
        .post('/api/chat-bot')
        .set('Content-Type', 'application/json');
      if (origin) req.set('Origin', origin);
      if (host) req.set('Host', host);
      return req.send('{}');
    };

    it('cho phép web của shop và request không có Origin', async () => {
      expect((await post(TEST_ORIGIN)).status).toBe(200);
      expect((await post()).status).toBe(200);
    });

    it('cho phép cùng máy chủ (mở web bằng IP trong mạng nhà)', async () => {
      expect((await post('http://192.168.1.50', '192.168.1.50')).status).toBe(200);
    });

    it('chặn origin lạ với request thay đổi dữ liệu, nhưng không chặn GET', async () => {
      const res = await post('https://trang-la.example');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Yêu cầu bị từ chối.' });
      const read = await request(testApp(database, { chatBot: okBot }))
        .get('/api/chat-bot')
        .set('Origin', 'https://trang-la.example');
      expect(read.status).toBe(200);
    });
  });

  it('gọi dồn quá giới hạn mỗi phút → 429', async () => {
    const app = testApp(database, { rateLimitPerMinute: 5 });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await request(app).get('/api/health')).status);
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });
});

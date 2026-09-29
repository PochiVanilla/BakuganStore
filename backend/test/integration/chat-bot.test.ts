import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/db/client';
import type { ChatBotHandlers } from '../../src/modules/bot/routes';
import { openTestDatabase, TEST_ORIGIN, testApp, testEnv } from '../helpers';

let database: Database;
beforeAll(async () => {
  database = await openTestDatabase();
});
afterAll(async () => {
  await database.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const BODY = {
  messages: [{ role: 'customer', text: 'Shop mở cửa mấy giờ?' }],
  topics: ['store-info'],
  extraKnowledge: '',
  facts: ['[Cửa hàng] TD Bakugan mở cửa 09:00 – 21:00.'],
};

/** Hàm bot giả: ghi lại request mà backend đưa vào. */
function recordingBot() {
  const seen: Request[] = [];
  const bodies: string[] = [];
  const handlers: ChatBotHandlers = {
    status: () => Response.json({ configured: false }),
    reply: async (req) => {
      seen.push(req);
      bodies.push(await req.text());
      return new Response(JSON.stringify({ reply: 'Chào bạn', handoff: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    },
  };
  return { handlers, seen, bodies };
}

describe('/api/chat-bot trong backend', () => {
  it('chuyển nguyên body và trả nguyên kết quả của hàm bot', async () => {
    const bot = recordingBot();
    const res = await request(testApp(database, { chatBot: bot.handlers }))
      .post('/api/chat-bot')
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(BODY));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: 'Chào bạn', handoff: false });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(bot.bodies[0]!)).toEqual(BODY);
    // Không chuyển Origin / Host của trình duyệt vào hàm bot (đã kiểm tra ở middleware).
    expect(bot.seen[0]!.headers.get('origin')).toBeNull();
  });

  it('IP đưa vào bot là IP Express tính ra, không phải header khách tự gửi', async () => {
    const bot = recordingBot();
    await request(testApp(database, { chatBot: bot.handlers }))
      .post('/api/chat-bot')
      .set('X-Forwarded-For', '1.2.3.4')
      .set('X-Real-IP', '5.6.7.8')
      .send('{}');
    const ip = bot.seen[0]!.headers.get('x-real-ip');
    expect(ip).not.toBe('1.2.3.4');
    expect(ip).not.toBe('5.6.7.8');
    expect(ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('sau Caddy (tin 1 lớp proxy): IP lấy từ X-Forwarded-For do Caddy thêm', async () => {
    const bot = recordingBot();
    const env = testEnv({ TRUST_PROXY_HOPS: '1' });
    await request(testApp(database, { env, chatBot: bot.handlers }))
      .post('/api/chat-bot')
      .set('X-Forwarded-For', '203.0.113.9')
      .set('X-Real-IP', '5.6.7.8')
      .send('{}');
    expect(bot.seen[0]!.headers.get('x-real-ip')).toBe('203.0.113.9');
  });

  it('hàm Gemini thật: chưa có khoá thì báo not-configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const app = testApp(database);
    const status = await request(app).get('/api/chat-bot');
    expect(status.body).toMatchObject({ configured: false });
    const reply = await request(app)
      .post('/api/chat-bot')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(BODY));
    expect(reply.status).toBe(503);
    expect(reply.body).toEqual({ error: 'not-configured' });
  });

  it('hàm Gemini thật: có khoá thì gọi Google, khoá chỉ nằm trong header gửi Google', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'khoa-thu-nghiem-123');
    const fetchMock = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ reply: 'Shop mở 9h–21h ạ', handoff: false }) }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv({ TRUST_PROXY_HOPS: '1' });
    const res = await request(testApp(database, { env }))
      .post('/api/chat-bot')
      .set('X-Forwarded-For', '198.51.100.20')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(BODY));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reply: 'Shop mở 9h–21h ạ', handoff: false });
    expect(JSON.stringify(res.body)).not.toContain('khoa-thu-nghiem-123');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).not.toContain('khoa-thu-nghiem-123');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('khoa-thu-nghiem-123');
  });

  it('hàm Gemini thật: một IP quá 8 lượt/phút thì bị chặn (rate-limited)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'khoa-thu-nghiem-123');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: '{"reply":"ok","handoff":false}' }] } }],
        }),
      ),
    );
    const env = testEnv({ TRUST_PROXY_HOPS: '1' });
    const app = testApp(database, { env });
    const statuses: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      const res = await request(app)
        .post('/api/chat-bot')
        .set('X-Forwarded-For', '198.51.100.77')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(BODY));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 8).every((status) => status === 200)).toBe(true);
    expect(statuses[8]).toBe(429);
  });
});

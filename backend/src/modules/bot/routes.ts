import express, {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from 'express';
import { chatBotReply, chatBotStatus } from '../../shared/chatBot';

/** Hàm bot viết theo chuẩn Web (Request → Response) như Vercel Function. */
export interface ChatBotHandlers {
  status: () => Response | Promise<Response>;
  reply: (request: Request) => Response | Promise<Response>;
}

const DEFAULT_HANDLERS: ChatBotHandlers = { status: chatBotStatus, reply: chatBotReply };

/** Không chép sang Express những header do Node tự tính lại. */
const SKIPPED_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection']);

/**
 * Chỉ đưa vào hàm bot những gì nó cần. IP lấy từ Express (đã tính theo số lớp proxy tin cậy),
 * không lấy header X-Real-IP / X-Forwarded-For do trình duyệt tự gửi, nên không ai
 * né được giới hạn 8 lượt/phút bằng cách giả IP. Origin đã kiểm tra ở middleware chung.
 */
function toWebRequest(req: ExpressRequest, body: Buffer | undefined): Request {
  const headers = new Headers({
    'content-type': req.get('content-type') ?? 'application/json',
    'x-real-ip': req.ip ?? 'unknown',
  });
  return new Request(new URL(req.originalUrl, 'http://api.internal'), {
    method: req.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  });
}

async function sendWebResponse(response: Response, res: ExpressResponse): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (!SKIPPED_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
  });
  res.send(Buffer.from(await response.arrayBuffer()));
}

/**
 * GET/POST /api/chat-bot — dùng lại nguyên hàm Gemini của web (api/chat-bot.ts), nên trang
 * "Thử bot" và "Kiểm tra kết nối" trong cài đặt admin chạy được ngay trên mini PC.
 * Khoá GEMINI_API_KEY đọc từ biến môi trường của server (file deploy/.env).
 */
export function chatBotRouter(handlers: ChatBotHandlers = DEFAULT_HANDLERS): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    await sendWebResponse(await handlers.status(), res);
  });
  router.post('/', express.raw({ type: () => true, limit: '512kb' }), async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : undefined;
    await sendWebResponse(await handlers.reply(toWebRequest(req, body)), res);
  });
  return router;
}

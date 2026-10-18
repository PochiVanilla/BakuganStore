import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/*
 * Đọc và kiểm tra biến môi trường một lần lúc khởi động. Thiếu hoặc sai biến bắt buộc
 * thì server không chạy (báo rõ biến nào), thay vì chạy rồi lỗi giữa chừng.
 * Không bao giờ in giá trị của biến ra log.
 */

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes');

/** Danh sách origin cách nhau bằng dấu phẩy, VD "http://localhost:3000,http://localhost:4173" */
const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** `pretty`: log dễ đọc khi lập trình; `json`: một dòng JSON mỗi sự kiện (mặc định ngoài máy dev) */
    LOG_FORMAT: z.enum(['json', 'pretty']).optional(),

    /** Địa chỉ web của shop, VD https://tdbakugan.vn — dùng để chặn trang lạ gọi API */
    PUBLIC_ORIGIN: z.url(),
    /** Origin khác được phép gọi API (khi phát triển: web chạy ở cổng khác) */
    EXTRA_ORIGINS: originList.default([]),
    /**
     * Số lớp proxy đứng trước backend. Trên mini PC là 1 (Caddy): backend chỉ tin IP do
     * Caddy chuyển vào. Chạy thẳng không qua proxy thì để 0.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, 'Chỉ gồm chữ, số và dấu _'),
    DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
    /** Tự chạy migration khi khởi động (mặc định bật) */
    DB_MIGRATE_ON_START: bool.default(true),

    /** Khoá Gemini: chỉ nằm ở server, không bao giờ gửi xuống trình duyệt */
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),

    /** Khoá ký token đăng nhập (ít nhất 32 ký tự ngẫu nhiên) */
    JWT_SECRET: z.string().min(32, 'Cần ít nhất 32 ký tự ngẫu nhiên').optional(),
    /** Khoá mã hoá số tài khoản ngân hàng: 32 byte, ghi dạng base64 */
    BANK_DATA_KEY: z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, 'Phải là 32 byte dạng base64')
      .optional(),

    /** Gửi email: `console` (in ra log, khi lập trình) hoặc `smtp` (Gmail, Resend SMTP…) */
    MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /** Người gửi, VD "TD Bakugan <shop@tdbakugan.vn>" */
    MAIL_FROM: z.string().default('TD Bakugan <no-reply@localhost>'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_SECRET', 'BANK_DATA_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'Bắt buộc khi chạy thật' });
        }
      }
    }
    if (env.MAIL_DRIVER === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'Bắt buộc khi MAIL_DRIVER=smtp' });
        }
      }
    }
  })
  .transform((env) => ({
    ...env,
    /*
     * Khi lập trình / test mà chưa đặt khoá thì tạo tạm khoá ngẫu nhiên (server báo cảnh báo):
     * khởi động lại là phiên đăng nhập cũ hết hiệu lực. Bản thật bắt buộc đặt (kiểm tra ở trên).
     */
    jwtSecret: new TextEncoder().encode(env.JWT_SECRET ?? randomBytes(48).toString('base64')),
    bankDataKey: env.BANK_DATA_KEY ? Buffer.from(env.BANK_DATA_KEY, 'base64') : randomBytes(32),
    generatedSecrets: [
      ...(env.JWT_SECRET ? [] : ['JWT_SECRET']),
      ...(env.BANK_DATA_KEY ? [] : ['BANK_DATA_KEY']),
    ],
    /** Cookie phiên chỉ gửi qua HTTPS khi web chạy HTTPS */
    secureCookies: env.PUBLIC_ORIGIN.startsWith('https://'),
    TRUST_PROXY_HOPS: env.TRUST_PROXY_HOPS ?? (env.NODE_ENV === 'production' ? 1 : 0),
    LOG_FORMAT: env.LOG_FORMAT ?? (env.NODE_ENV === 'development' ? 'pretty' : 'json'),
    isProduction: env.NODE_ENV === 'production',
    /** Mọi origin được gọi API: web của shop + các origin thêm khi phát triển */
    allowedOrigins: [
      new URL(env.PUBLIC_ORIGIN).origin,
      ...env.EXTRA_ORIGINS.map((origin) => new URL(origin).origin),
    ],
  }));

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Biến môi trường chưa đúng:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/** Biến trống ("") coi như chưa đặt, để dòng `GEMINI_API_KEY=` trong .env không bị coi là có khoá. */
function withoutEmpty(source: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '',
    ),
  );
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(withoutEmpty(source));
  if (!parsed.success) {
    throw new EnvError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(chung)'}: ${issue.message}`),
    );
  }
  return parsed.data;
}

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
  })
  .transform((env) => ({
    ...env,
    TRUST_PROXY_HOPS: env.TRUST_PROXY_HOPS ?? (env.NODE_ENV === 'production' ? 1 : 0),
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

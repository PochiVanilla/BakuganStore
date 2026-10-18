import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** SHA-256 dạng hex — CSDL chỉ lưu mã băm của token, không lưu token gốc. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Chuỗi ngẫu nhiên an toàn, dùng làm refresh token, mã đặt lại mật khẩu… */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** So sánh hai chuỗi không lộ thời gian (chống dò từng ký tự). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const VERSION = 'v1';

/**
 * Mã hoá AES-256-GCM (có kiểm tra toàn vẹn). Kết quả: "v1:" + base64(iv 12 byte + tag 16 byte + dữ liệu).
 * Dùng cho số tài khoản ngân hàng của khách.
 */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [version, body] = payload.split(':');
  if (version !== VERSION || !body) throw new Error('Dữ liệu mã hoá không đúng định dạng');
  const raw = Buffer.from(body, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

import { createHmac, randomBytes } from 'node:crypto';
import type { Env } from '../../config/env';
import { safeEqual } from '../../lib/crypto';
import { CARD_BRANDS, type CardBrand } from '../../shared/types';

/*
 * Khuôn chung cho cổng thanh toán thẻ. Đổi cổng (OnePay, VNPAY…) chỉ là viết thêm một lớp
 * đúng khuôn này. Bản `mock` chạy ngay trên server: thẻ thử như web, kết quả gửi về bằng
 * tham số có chữ ký HMAC y như cổng thật, nên luồng xử lý kết quả (IPN) là luồng thật.
 */

/** Kết quả một lượt trả thẻ, như cổng báo về (đã kiểm tra chữ ký) */
export interface GatewayCallback {
  attemptId: string;
  amount: number;
  success: boolean;
  gatewayTxnId?: string;
  brand?: CardBrand;
  last4?: string;
  /** Mã kết quả của cổng ("00" = thành công) */
  code: string;
  message: string;
}

export interface CardGateway {
  readonly name: string;
  /** Link trang trả tiền của cổng cho một lượt */
  createPayment(input: { attemptId: string; orderId: string; amount: number }): {
    redirectUrl: string;
  };
  /** Kiểm tra chữ ký tham số cổng gửi về; sai chữ ký → valid = false */
  verifyCallback(params: Record<string, string>): { valid: boolean; callback?: GatewayCallback };
  /** Hoàn tiền một lượt đã trả — chỉ gọi khi admin bấm */
  refund(input: {
    attemptId: string;
    gatewayTxnId: string;
    amount: number;
  }): Promise<{ ok: true; refundId: string } | { ok: false; message: string }>;
}

const SIGNATURE = 'signature';

/** Chuỗi để ký: các tham số (trừ chữ ký) xếp theo tên, nối "tên=giá trị&…" */
function signingString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== SIGNATURE)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

export class MockCardGateway implements CardGateway {
  readonly name = 'mock';

  constructor(private readonly secret: Uint8Array) {}

  sign(params: Record<string, string>): string {
    return createHmac('sha256', this.secret).update(signingString(params)).digest('hex');
  }

  createPayment(input: { attemptId: string; orderId: string; amount: number }) {
    // Cổng giả lập dùng trang có sẵn của web; cổng thật trả về link trên tên miền của cổng.
    return {
      redirectUrl: `/thanh-toan/cong-the/${encodeURIComponent(input.orderId)}?phien=${encodeURIComponent(input.attemptId)}`,
    };
  }

  /** Cổng giả lập "gọi về" server: dựng tham số kèm chữ ký như cổng thật. */
  buildCallback(callback: GatewayCallback): Record<string, string> {
    const params: Record<string, string> = {
      attemptId: callback.attemptId,
      amount: String(callback.amount),
      result: callback.success ? 'success' : 'failed',
      code: callback.code,
      message: callback.message,
      ...(callback.gatewayTxnId ? { txnId: callback.gatewayTxnId } : {}),
      ...(callback.brand ? { brand: callback.brand } : {}),
      ...(callback.last4 ? { last4: callback.last4 } : {}),
    };
    return { ...params, [SIGNATURE]: this.sign(params) };
  }

  verifyCallback(params: Record<string, string>) {
    const signature = params[SIGNATURE];
    if (typeof signature !== 'string' || !safeEqual(signature, this.sign(params))) {
      return { valid: false };
    }
    const amount = Number(params.amount);
    const brand = CARD_BRANDS.find((value) => value === params.brand);
    if (!params.attemptId || !Number.isSafeInteger(amount)) return { valid: false };
    return {
      valid: true,
      callback: {
        attemptId: params.attemptId,
        amount,
        success: params.result === 'success',
        gatewayTxnId: params.txnId || undefined,
        brand,
        last4: /^\d{4}$/.test(params.last4 ?? '') ? params.last4 : undefined,
        code: (params.code ?? '').slice(0, 20),
        message: (params.message ?? '').slice(0, 255),
      } satisfies GatewayCallback,
    };
  }

  async refund(_input: {
    attemptId: string;
    gatewayTxnId: string;
    amount: number;
  }): Promise<{ ok: true; refundId: string } | { ok: false; message: string }> {
    // Cổng giả lập: lệnh hoàn luôn thành công.
    return { ok: true, refundId: `RF${randomBytes(6).toString('hex').toUpperCase()}` };
  }
}

/** Mã giao dịch giả của cổng giả lập, VD GD1A2B3C4D5E6F */
export function mockTransactionId(): string {
  return `GD${randomBytes(6).toString('hex').toUpperCase()}`;
}

/**
 * Cổng theo CARD_GATEWAY. `mock`: khoá ký riêng, suy ra từ JWT_SECRET (không cần thêm biến).
 * `none`: chưa có cổng → web không cho chọn trả thẻ.
 */
export function createCardGateway(env: Pick<Env, 'cardGateway' | 'jwtSecret'>): CardGateway | null {
  if (env.cardGateway !== 'mock') return null;
  const key = createHmac('sha256', env.jwtSecret).update('td-bakugan:mock-card-gateway').digest();
  return new MockCardGateway(key);
}

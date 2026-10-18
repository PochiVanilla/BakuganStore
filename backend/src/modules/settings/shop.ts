import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { settings } from '../../db/schema';
import type { Tx } from '../../db/tx';
import { INITIAL_SHOP_SETTINGS } from '../../shared/defaults';
import { DEFAULT_CHECKOUT_CONFIG } from '../../shared/pricing';
import type { CheckoutConfig, ShopBankInfo, ShopSettings } from '../../shared/types';

/*
 * Cài đặt shop (bảng settings, dòng `shop`): tiền nạp lên Lv2, tài khoản nhận chuyển khoản,
 * thẻ, giao quốc tế. Đọc lúc nào cũng kiểm tra bằng Zod; dòng hỏng / thiếu ô thì dùng giá trị
 * mặc định cho ô đó, để một lần sửa tay sai trong CSDL không làm hỏng trang thanh toán.
 */

const money = z.number().int().min(0).max(1_000_000_000);

export const shopSettingsSchema = z.object({
  memberDepositAmount: money.catch(INITIAL_SHOP_SETTINGS.memberDepositAmount),
  bank: z
    .object({
      bankName: z.string().max(100),
      accountNumber: z.string().max(40),
      accountHolder: z.string().max(100),
    })
    .catch(INITIAL_SHOP_SETTINGS.bank),
  cardPayments: z.boolean().catch(INITIAL_SHOP_SETTINGS.cardPayments),
  international: z
    .object({
      enabled: z.boolean(),
      feeAsia: money,
      feeWorld: money,
      usdRate: z.number().int().min(1).max(1_000_000),
    })
    .catch(INITIAL_SHOP_SETTINGS.international),
});

export async function readShopSettings(executor: Db | Tx): Promise<ShopSettings> {
  const [row] = await executor
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.name, 'shop'))
    .limit(1);
  const parsed = shopSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : INITIAL_SHOP_SETTINGS;
}

/**
 * Những gì trang thanh toán cần biết. Thẻ chỉ bật khi admin bật VÀ backend có cổng thanh toán;
 * giao quốc tế chỉ trả bằng thẻ nên tắt thẻ là giao quốc tế cũng tắt.
 */
export function checkoutConfigOf(shop: ShopSettings, cardGatewayReady: boolean): CheckoutConfig {
  const cardPayments = shop.cardPayments && cardGatewayReady;
  return {
    ...DEFAULT_CHECKOUT_CONFIG,
    cardPayments,
    international: { ...shop.international, enabled: shop.international.enabled && cardPayments },
  };
}

/** Tài khoản nhận chuyển khoản của shop — null khi admin chưa nhập số tài khoản. */
export function shopBankOf(shop: ShopSettings): ShopBankInfo | null {
  return shop.bank.accountNumber.trim() ? { ...shop.bank } : null;
}

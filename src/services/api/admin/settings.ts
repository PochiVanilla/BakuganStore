import type { ApiResponse, BotSettings, ShopSettings } from '@/types';
import { readDb, resetDb, updateDb } from '@/mocks/db';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';

export async function getShopSettings(): Promise<ShopSettings> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ShopSettings>>('/admin/settings/shop');
    return data.data;
  }
  requireAdmin();
  return mockDelay(readDb().shopSettings, 160);
}

function invalidSetting(message: string, field: string): never {
  throw new MockApiError(message, 422, { [field]: message });
}

/** Lưu một phần cài đặt cửa hàng (mỗi khung trong trang Cài đặt lưu phần của nó). */
export async function updateShopSettings(patch: Partial<ShopSettings>): Promise<ShopSettings> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<ShopSettings>>(
      '/admin/settings/shop',
      patch,
    );
    return data.data;
  }
  requireAdmin();
  const next = structuredClone(readDb().shopSettings) as ShopSettings;

  if (patch.memberDepositAmount !== undefined) {
    const amount = patch.memberDepositAmount;
    if (!Number.isInteger(amount) || amount < 0 || amount > 50_000_000) {
      invalidSetting('Số tiền nạp lên Lv2 phải từ 0 đến 50.000.000₫.', 'memberDepositAmount');
    }
    next.memberDepositAmount = amount;
  }
  if (patch.bank) {
    const accountNumber = patch.bank.accountNumber.replace(/\s+/g, '');
    if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
      invalidSetting('Số tài khoản chỉ gồm 6–20 chữ số.', 'accountNumber');
    }
    next.bank = {
      bankName: patch.bank.bankName.trim(),
      accountNumber,
      accountHolder: patch.bank.accountHolder.trim().toUpperCase(),
    };
  }
  if (patch.cardPayments !== undefined) next.cardPayments = patch.cardPayments;
  if (patch.international) {
    const { enabled, feeAsia, feeWorld, usdRate } = patch.international;
    const fee = (value: number, field: string): number => {
      if (!Number.isInteger(value) || value < 0 || value > 20_000_000) {
        invalidSetting('Phí gửi phải từ 0 đến 20.000.000₫.', field);
      }
      return value;
    };
    if (!Number.isInteger(usdRate) || usdRate < 1_000 || usdRate > 100_000) {
      invalidSetting('Tỉ giá phải từ 1.000 đến 100.000₫ cho 1 USD.', 'usdRate');
    }
    next.international = {
      enabled,
      feeAsia: fee(feeAsia, 'feeAsia'),
      feeWorld: fee(feeWorld, 'feeWorld'),
      usdRate,
    };
  }
  // Đơn quốc tế chỉ trả bằng thẻ: tắt thẻ thì cũng tắt nhận đơn quốc tế.
  if (!next.cardPayments) next.international = { ...next.international, enabled: false };

  updateDb((db) => {
    db.shopSettings = next;
  });
  return mockDelay(next, 300);
}

export async function getBotSettings(): Promise<BotSettings> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BotSettings>>('/admin/settings/bot');
    return data.data;
  }
  requireAdmin();
  return mockDelay(readDb().botSettings, 160);
}

export async function updateBotSettings(
  settings: Omit<BotSettings, 'updatedAt'>,
): Promise<BotSettings> {
  if (!USE_MOCK) {
    const { data } = await apiClient.put<ApiResponse<BotSettings>>('/admin/settings/bot', settings);
    return data.data;
  }
  requireAdmin();
  const saved: BotSettings = { ...settings, updatedAt: new Date().toISOString() };
  updateDb((db) => {
    db.botSettings = saved;
  });
  return mockDelay(saved, 350);
}

/** Chỉ có ở bản demo: xoá mọi thay đổi, nạp lại dữ liệu mẫu. */
export async function resetDemoData(): Promise<void> {
  requireAdmin();
  resetDb();
  await mockDelay(null, 300);
}

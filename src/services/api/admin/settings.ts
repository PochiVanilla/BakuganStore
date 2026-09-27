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

export async function updateShopSettings(settings: ShopSettings): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.put('/admin/settings/shop', settings);
    return;
  }
  requireAdmin();
  const amount = settings.memberDepositAmount;
  if (!Number.isInteger(amount) || amount < 0 || amount > 50_000_000) {
    throw new MockApiError('Số tiền nạp lên Lv2 phải từ 0 đến 50.000.000₫.', 422, {
      memberDepositAmount: 'Số tiền không hợp lệ.',
    });
  }
  const accountNumber = settings.bank.accountNumber.replace(/\s+/g, '');
  if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
    throw new MockApiError('Số tài khoản chỉ gồm 6–20 chữ số.', 422, {
      accountNumber: 'Số tài khoản chỉ gồm 6–20 chữ số.',
    });
  }
  updateDb((db) => {
    db.shopSettings = {
      memberDepositAmount: amount,
      bank: {
        bankName: settings.bank.bankName.trim(),
        accountNumber,
        accountHolder: settings.bank.accountHolder.trim().toUpperCase(),
      },
    };
  });
  await mockDelay(null, 300);
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

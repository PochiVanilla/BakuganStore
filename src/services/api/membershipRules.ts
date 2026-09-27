import type { MemberLevel, MembershipInfo } from '@/types';
import { PURCHASES_FOR_LV2 } from '@/constants/catalog';
import type { MockDatabase, UserRecord } from '@/mocks/db';

/* ============================================================
   Luật hạng thành viên — dùng chung cho phía khách, trang quản trị
   và luồng đơn hàng. Chỉ chạy trong tầng "server" mock.

   Lên Lv2 (được tham gia đấu giá) bằng MỘT trong ba cách:
   1. Nhận đủ 3 Bakugan mua ở TD shop (đơn đã hoàn tất) — tự động.
   2. Nạp số tiền admin quy định — admin xác nhận đã nhận tiền.
   3. Admin xét duyệt thẳng.
   ============================================================ */

export function levelOf(user: Pick<UserRecord, 'memberLevel'>): MemberLevel {
  return user.memberLevel ?? 1;
}

/** Số Bakugan khách đã nhận (chỉ tính đơn hoàn tất, không tính đơn huỷ / hoàn). */
export function purchasedItemCount(db: Readonly<MockDatabase>, userId: string): number {
  return db.orders
    .filter((order) => order.userId === userId && order.status === 'completed')
    .reduce((sum, order) => sum + order.items.length, 0);
}

function closePendingRequests(db: MockDatabase, userId: string, at: string, note: string): void {
  db.membershipRequests.forEach((request) => {
    if (request.userId !== userId || request.status !== 'pending') return;
    request.status = 'approved';
    request.resolvedAt = at;
    request.resolvedBy = 'Hệ thống';
    request.adminNote = note;
  });
}

/** Đủ 3 con thì tự lên Lv2. Trả về true nếu khách vừa được lên hạng. */
export function applyPurchaseUpgrade(db: MockDatabase, userId: string, at: string): boolean {
  const user = db.users.find((item) => item.id === userId);
  if (!user || user.role !== 'customer' || levelOf(user) >= 2) return false;
  if (purchasedItemCount(db, userId) < PURCHASES_FOR_LV2) return false;
  user.memberLevel = 2;
  user.levelSource = 'purchases';
  user.levelUpAt = at;
  closePendingRequests(db, userId, at, `Tự lên Lv2 vì đã mua đủ ${PURCHASES_FOR_LV2} Bakugan.`);
  return true;
}

/** Nội dung chuyển khoản khách ghi khi nạp tiền, để admin dò trong sao kê. */
export function transferNoteFor(user: Pick<UserRecord, 'id' | 'phone'>): string {
  return `TDLV2 ${user.phone.trim() || user.id.toUpperCase()}`;
}

export function membershipInfoOf(db: Readonly<MockDatabase>, user: UserRecord): MembershipInfo {
  const bank = db.shopSettings.bank;
  return {
    level: levelOf(user),
    source: user.levelSource,
    levelUpAt: user.levelUpAt,
    purchasedCount: purchasedItemCount(db, user.id),
    purchaseGoal: PURCHASES_FOR_LV2,
    depositAmount: db.shopSettings.memberDepositAmount,
    depositBalance: user.depositBalance ?? 0,
    pendingRequest: db.membershipRequests.find(
      (request) => request.userId === user.id && request.status === 'pending',
    ),
    transferNote: transferNoteFor(user),
    bank: bank.accountNumber.trim() ? { ...bank } : null,
  };
}

import type { ApiResponse, MembershipInfo } from '@/types';
import { createId, readDb, updateDb } from '@/mocks/db';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { requireUser } from './mockSession';
import {
  applyPurchaseUpgrade,
  levelOf,
  membershipInfoOf,
  transferNoteFor,
} from './membershipRules';

/* ============================================================
   Hạng thành viên của khách đang đăng nhập.
   Lv2 trở lên mới được đặt giá ở sàn đấu giá.
   ============================================================ */

function currentInfo(): MembershipInfo {
  const db = readDb();
  const user = requireUser();
  return membershipInfoOf(db, db.users.find((item) => item.id === user.id) ?? user);
}

export async function fetchMyMembership(): Promise<MembershipInfo> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<MembershipInfo>>('/me/membership');
    return data.data;
  }
  const user = requireUser();
  // Phòng khi khách đã đủ điều kiện mà chưa được nâng (VD: dữ liệu cũ).
  const info = membershipInfoOf(readDb(), user);
  if (info.level < 2 && info.purchasedCount >= info.purchaseGoal) {
    updateDb((db) => applyPurchaseUpgrade(db, user.id, new Date().toISOString()));
  }
  return mockDelay(currentInfo(), 160);
}

function assertCanRequest(): void {
  const db = readDb();
  const user = requireUser();
  if (user.role !== 'customer') {
    throw new MockApiError('Tài khoản quản trị không cần lên hạng.', 409);
  }
  if (levelOf(user) >= 2) throw new MockApiError('Bạn đã là thành viên Lv2 rồi.', 409);
  const pending = db.membershipRequests.some(
    (request) => request.userId === user.id && request.status === 'pending',
  );
  if (pending) {
    throw new MockApiError('Bạn đã có một yêu cầu đang chờ shop xử lý.', 409);
  }
}

/** Khách báo đã chuyển khoản số tiền nạp — admin đối soát rồi xác nhận lên Lv2. */
export async function requestDepositUpgrade(message = ''): Promise<MembershipInfo> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<MembershipInfo>>('/me/membership/deposit', {
      message,
    });
    return data.data;
  }
  assertCanRequest();
  const user = requireUser();
  updateDb((db) => {
    db.membershipRequests.unshift({
      id: createId('mbr'),
      userId: user.id,
      kind: 'deposit',
      amount: db.shopSettings.memberDepositAmount,
      transferNote: transferNoteFor(user),
      message: message.trim().slice(0, 300) || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  });
  return mockDelay(currentInfo(), 400);
}

/** Khách nhờ admin xét duyệt lên Lv2 (VD: đã mua nhiều tại shop, khách quen). */
export async function requestLevelReview(message: string): Promise<MembershipInfo> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<MembershipInfo>>('/me/membership/review', {
      message,
    });
    return data.data;
  }
  const text = message.trim();
  if (text.length < 10) {
    throw new MockApiError('Bạn viết thêm vài dòng để shop hiểu vì sao muốn lên Lv2 nhé.', 422, {
      message: 'Viết ít nhất 10 ký tự.',
    });
  }
  assertCanRequest();
  const user = requireUser();
  updateDb((db) => {
    db.membershipRequests.unshift({
      id: createId('mbr'),
      userId: user.id,
      kind: 'review',
      message: text.slice(0, 500),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  });
  return mockDelay(currentInfo(), 400);
}

/** Khách rút lại yêu cầu đang chờ. */
export async function cancelMembershipRequest(): Promise<MembershipInfo> {
  if (!USE_MOCK) {
    const { data } = await apiClient.delete<ApiResponse<MembershipInfo>>('/me/membership/request');
    return data.data;
  }
  const user = requireUser();
  updateDb((db) => {
    db.membershipRequests = db.membershipRequests.filter(
      (request) => !(request.userId === user.id && request.status === 'pending'),
    );
  });
  return mockDelay(currentInfo(), 250);
}

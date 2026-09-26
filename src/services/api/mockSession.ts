import type { User } from '@/types';
import { readDb, type UserRecord } from '@/mocks/db';
import { AUTH_TOKEN_KEY, MockApiError } from './client';

/* ============================================================
   Xác thực phía "server" của chế độ mock.

   Token mang id người dùng, và mọi API quản trị đều tự đọc token rồi
   tra quyền trong kho dữ liệu — không tin vào cờ `role` phía giao diện.
   Backend thật cần làm y hệt: route guard ở frontend chỉ để điều hướng,
   quyền thật phải được kiểm tra ở server cho từng request.
   ============================================================ */

export function issueMockToken(kind: 'access' | 'refresh', userId: string): string {
  return `${kind}.${btoa(userId)}.${Date.now().toString(36)}.mock-signature`;
}

function userIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const [kind, encoded] = token.split('.');
  if (kind !== 'access' || !encoded) return null;
  try {
    return atob(encoded);
  } catch {
    return null;
  }
}

/** Người đang gọi API, suy ra từ token đang lưu (đúng như server đọc header Authorization). */
export function currentMockUser(): UserRecord | null {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
  const userId = userIdFromToken(token);
  if (!userId) return null;
  return readDb().users.find((user) => user.id === userId) ?? null;
}

export function requireAdmin(): UserRecord {
  const user = currentMockUser();
  if (!user) {
    throw new MockApiError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 401);
  }
  if (user.status !== 'active') {
    throw new MockApiError('Tài khoản của bạn đang bị khoá.', 403);
  }
  if (user.role !== 'admin') {
    throw new MockApiError('Bạn không có quyền truy cập khu vực quản trị.', 403);
  }
  return user;
}

/**
 * Bản hồ sơ trả về cho chính người dùng. Chọn từng trường cho phép nên ghi
 * chú nội bộ, thẻ phân loại hay lý do khoá của admin không lọt ra ngoài.
 */
export function toSessionUser(record: UserRecord): User {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
    addresses: record.addresses,
    role: record.role,
    birthday: record.birthday,
    gender: record.gender,
    bankAccount: record.bankAccount,
  };
}

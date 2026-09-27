import type {
  AccountStatus,
  AdminCustomer,
  AdminCustomerDetail,
  ApiResponse,
  MemberLevel,
  MembershipRequest,
  UserRole,
} from '@/types';
import { hydrateOrder, readDb, updateDb } from '@/mocks/db';
import { normalizeSearch } from '@/utils/slugify';
import { listAuctionsSnapshot } from '../auctionService';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { toAdminCustomer } from './shared';

export interface CustomerQuery {
  keyword?: string;
  status?: AccountStatus | 'all';
  role?: UserRole | 'all';
  /** 'requests' = khách đang có yêu cầu lên Lv2 chờ duyệt */
  level?: MemberLevel | 'all' | 'requests';
  sort?: 'recent' | 'spent' | 'orders' | 'name';
}

export async function listCustomers(query: CustomerQuery = {}): Promise<AdminCustomer[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminCustomer[]>>('/admin/customers', {
      params: query,
    });
    return data.data;
  }
  requireAdmin();
  const { keyword = '', status = 'all', role = 'all', level = 'all', sort = 'recent' } = query;
  const db = readDb();
  const auctions = listAuctionsSnapshot();
  const needle = normalizeSearch(keyword);

  const rows = db.users
    .filter((user) => (status === 'all' ? true : user.status === status))
    .filter((user) => (role === 'all' ? true : user.role === role))
    .filter((user) =>
      needle
        ? normalizeSearch(
            `${user.fullName} ${user.email} ${user.phone} ${user.tags.join(' ')}`,
          ).includes(needle)
        : true,
    )
    .map((user) => toAdminCustomer(user, db.orders, auctions, db.membershipRequests))
    .filter((customer) => {
      if (level === 'all') return true;
      if (level === 'requests') return Boolean(customer.pendingLevelRequest);
      return customer.role === 'customer' && customer.memberLevel === level;
    });

  const sorters: Record<
    NonNullable<CustomerQuery['sort']>,
    (a: AdminCustomer, b: AdminCustomer) => number
  > = {
    recent: (a, b) => (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? ''),
    spent: (a, b) => b.stats.totalSpent - a.stats.totalSpent,
    orders: (a, b) => b.stats.orderCount - a.stats.orderCount,
    name: (a, b) => a.fullName.localeCompare(b.fullName, 'vi'),
  };

  return mockDelay(rows.sort(sorters[sort]), 260);
}

export async function getCustomer(customerId: string): Promise<AdminCustomerDetail> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminCustomerDetail>>(
      `/admin/customers/${customerId}`,
    );
    return data.data;
  }
  requireAdmin();
  const db = readDb();
  const record = db.users.find((user) => user.id === customerId);
  if (!record) throw new MockApiError('Không tìm thấy khách hàng này.', 404);
  const auctions = listAuctionsSnapshot();

  const participation = auctions
    .map((auction) => {
      const mine = auction.bids.filter((bid) => bid.bidderId === customerId);
      if (mine.length === 0) return null;
      return {
        auctionId: auction.id,
        title: auction.title,
        myHighestBid: Math.max(...mine.map((bid) => bid.amount)),
        bidCount: mine.length,
        isWinning: auction.bids[0]?.bidderId === customerId,
        status: auction.status,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return mockDelay(
    {
      ...toAdminCustomer(record, db.orders, auctions, db.membershipRequests),
      levelRequests: db.membershipRequests
        .filter((request) => request.userId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      orders: db.orders
        .filter((order) => order.userId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((order) => hydrateOrder(order, db)),
      auctions: participation,
    },
    260,
  );
}

export interface CustomerUpdateInput {
  fullName: string;
  email: string;
  phone: string;
  tags: string[];
  adminNote: string;
}

export async function updateCustomer(
  customerId: string,
  input: CustomerUpdateInput,
): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/admin/customers/${customerId}`, input);
    return;
  }
  requireAdmin();
  const email = input.email.trim().toLowerCase();
  const db = readDb();
  if (db.users.some((user) => user.id !== customerId && user.email.toLowerCase() === email)) {
    throw new MockApiError('Email này đã thuộc về tài khoản khác.', 409, {
      email: 'Email này đã thuộc về tài khoản khác.',
    });
  }
  updateDb((draft) => {
    const user = draft.users.find((item) => item.id === customerId);
    if (!user) throw new MockApiError('Không tìm thấy khách hàng này.', 404);
    user.fullName = input.fullName.trim();
    user.email = email;
    user.phone = input.phone.trim();
    user.tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
    user.adminNote = input.adminNote.trim();
  });
  await mockDelay(null, 400);
}

export async function setCustomerStatus(
  customerId: string,
  status: AccountStatus,
  reason?: string,
): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/admin/customers/${customerId}/status`, { status, reason });
    return;
  }
  const admin = requireAdmin();
  if (admin.id === customerId) {
    throw new MockApiError('Bạn không thể tự khoá tài khoản của chính mình.', 409);
  }
  if (status === 'locked' && !reason?.trim()) {
    throw new MockApiError('Vui lòng ghi lý do khoá để lưu vết.', 422, {
      reason: 'Vui lòng ghi lý do khoá để lưu vết.',
    });
  }
  updateDb((db) => {
    const user = db.users.find((item) => item.id === customerId);
    if (!user) throw new MockApiError('Không tìm thấy khách hàng này.', 404);
    user.status = status;
    user.lockedReason = status === 'locked' ? reason?.trim() : undefined;
  });
  await mockDelay(null, 400);
}

export async function setCustomerRole(customerId: string, role: UserRole): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/admin/customers/${customerId}/role`, { role });
    return;
  }
  const admin = requireAdmin();
  if (admin.id === customerId) {
    throw new MockApiError('Bạn không thể tự đổi quyền của chính mình.', 409);
  }
  updateDb((db) => {
    const user = db.users.find((item) => item.id === customerId);
    if (!user) throw new MockApiError('Không tìm thấy tài khoản này.', 404);
    user.role = role;
  });
  await mockDelay(null, 400);
}

/** Gửi email đặt lại mật khẩu cho khách — admin không bao giờ tự đặt mật khẩu hộ. */
export async function sendPasswordReset(customerId: string): Promise<{ email: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ email: string }>>(
      `/admin/customers/${customerId}/password-reset`,
    );
    return data.data;
  }
  requireAdmin();
  const user = readDb().users.find((item) => item.id === customerId);
  if (!user) throw new MockApiError('Không tìm thấy khách hàng này.', 404);
  return mockDelay({ email: user.email }, 600);
}

/* ---------------- Hạng thành viên ---------------- */

/** Admin đặt hạng trực tiếp (duyệt lên Lv2 hoặc hạ về Lv1). */
export async function setMemberLevel(
  customerId: string,
  level: MemberLevel,
  note = '',
): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/admin/customers/${customerId}/level`, { level, note });
    return;
  }
  const admin = requireAdmin();
  const now = new Date().toISOString();
  updateDb((db) => {
    const user = db.users.find((item) => item.id === customerId);
    if (!user || user.role !== 'customer') {
      throw new MockApiError('Chỉ đặt hạng cho tài khoản khách hàng.', 404);
    }
    user.memberLevel = level;
    user.levelSource = level >= 2 ? 'admin' : undefined;
    user.levelUpAt = level >= 2 ? now : undefined;
    // Chỉ đóng yêu cầu xét duyệt. Yêu cầu nạp tiền vẫn chờ admin đối soát riêng
    // để ghi nhận đúng số tiền khách đã chuyển.
    db.membershipRequests.forEach((request) => {
      if (request.userId !== customerId || request.status !== 'pending') return;
      if (request.kind !== 'review') return;
      request.status = level >= 2 ? 'approved' : 'rejected';
      request.resolvedAt = now;
      request.resolvedBy = admin.fullName;
      request.adminNote = note.trim() || undefined;
    });
  });
  await mockDelay(null, 350);
}

/**
 * Xử lý yêu cầu lên Lv2 của khách.
 * - Duyệt yêu cầu nạp tiền: ghi nhận số tiền vào tiền nạp của khách rồi lên Lv2.
 * - Từ chối: ghi lý do để khách biết.
 */
export async function resolveLevelRequest(
  requestId: string,
  approve: boolean,
  note = '',
): Promise<MembershipRequest> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<MembershipRequest>>(
      `/admin/membership-requests/${requestId}/${approve ? 'approve' : 'reject'}`,
      { note },
    );
    return data.data;
  }
  const admin = requireAdmin();
  if (!approve && !note.trim()) {
    throw new MockApiError('Ghi lý do từ chối để khách biết cần làm gì tiếp.', 422, {
      note: 'Ghi lý do từ chối.',
    });
  }
  const now = new Date().toISOString();
  const resolved = updateDb((db) => {
    const request = db.membershipRequests.find((item) => item.id === requestId);
    if (!request) throw new MockApiError('Không tìm thấy yêu cầu này.', 404);
    if (request.status !== 'pending') throw new MockApiError('Yêu cầu này đã được xử lý.', 409);
    request.status = approve ? 'approved' : 'rejected';
    request.resolvedAt = now;
    request.resolvedBy = admin.fullName;
    request.adminNote = note.trim() || undefined;
    if (approve) {
      const user = db.users.find((item) => item.id === request.userId);
      if (user) {
        if (request.kind === 'deposit' && request.amount) {
          user.depositBalance = (user.depositBalance ?? 0) + request.amount;
        }
        if ((user.memberLevel ?? 1) < 2) {
          user.memberLevel = 2;
          user.levelSource = request.kind === 'deposit' ? 'deposit' : 'admin';
          user.levelUpAt = now;
        }
      }
    }
    return request;
  });
  return mockDelay(resolved, 350);
}

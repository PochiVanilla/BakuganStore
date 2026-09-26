import type { Address, ApiResponse, AuthSession, BankAccount, Order, User } from '@/types';
import type {
  AddressFormValues,
  BankAccountFormValues,
  ChangePasswordFormValues,
  LoginFormValues,
  ProfileFormValues,
  RegisterFormValues,
} from '@/features/auth/schemas';
import { ADMIN_ACCOUNT } from '@/mocks';
import { createId, hydrateOrder, readDb, updateDb, type UserRecord } from '@/mocks/db';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { issueMockToken, toSessionUser } from './mockSession';

function findUserByEmail(email: string): UserRecord | undefined {
  const needle = email.trim().toLowerCase();
  return readDb().users.find((user) => user.email.toLowerCase() === needle);
}

function requireUser(userId: string): UserRecord {
  const user = readDb().users.find((item) => item.id === userId);
  if (!user) throw new MockApiError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 401);
  return user;
}

export async function register(values: RegisterFormValues): Promise<{ email: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ email: string }>>('/auth/register', values);
    return data.data;
  }
  if (findUserByEmail(values.email)) {
    throw new MockApiError('Email này đã được đăng ký.', 409, {
      email: 'Email này đã được đăng ký.',
    });
  }
  updateDb((db) => {
    db.users.push({
      id: createId('usr'),
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      createdAt: new Date().toISOString(),
      addresses: [],
      role: 'customer',
      status: 'active',
      tags: ['Khách mới'],
      adminNote: '',
    });
  });
  return mockDelay({ email: values.email }, 700);
}

const INVALID_LOGIN = 'Email hoặc mật khẩu không đúng.';

export async function login(values: LoginFormValues): Promise<AuthSession> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/login', values);
    return data.data;
  }

  const existing = findUserByEmail(values.email);
  // Tài khoản quản trị phải đúng mật khẩu; tài khoản khách của bản demo thì
  // chấp nhận mọi mật khẩu từ 8 ký tự vì chưa có backend lưu mật khẩu.
  const passwordOk =
    existing?.role === 'admin'
      ? values.password === ADMIN_ACCOUNT.password
      : values.password.length >= 8;
  if (!passwordOk) {
    throw new MockApiError(INVALID_LOGIN, 401, { password: INVALID_LOGIN });
  }
  if (existing?.status === 'locked') {
    throw new MockApiError(
      'Tài khoản này đang bị tạm khoá. Vui lòng liên hệ hotline của shop để được hỗ trợ.',
      423,
    );
  }

  const now = new Date().toISOString();
  const record = updateDb((db) => {
    let user = db.users.find((item) => item.id === existing?.id);
    if (!user) {
      // Email chưa có trong hệ thống: bản demo tự tạo tài khoản khách mới.
      user = {
        id: createId('usr'),
        fullName: values.email.split('@')[0] ?? 'Người chơi TD',
        email: values.email.trim().toLowerCase(),
        phone: '',
        createdAt: now,
        addresses: [],
        role: 'customer',
        status: 'active',
        tags: ['Khách mới'],
        adminNote: '',
      };
      db.users.push(user);
    }
    user.lastLoginAt = now;
    return user;
  });

  return mockDelay(
    {
      user: toSessionUser(record),
      accessToken: issueMockToken('access', record.id),
      refreshToken: issueMockToken('refresh', record.id),
    },
    700,
  );
}

export async function requestPasswordReset(email: string): Promise<{ email: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ email: string }>>('/auth/forgot-password', {
      email,
    });
    return data.data;
  }
  return mockDelay({ email }, 700);
}

/**
 * Ở chế độ HTTP, server tự biết người gọi qua token nên `userId` bị bỏ qua.
 * Chế độ mock cần id để biết ghi vào hồ sơ nào.
 */
export async function updateProfile(values: ProfileFormValues, userId: string): Promise<User> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<User>>('/auth/me', values);
    return data.data;
  }
  const owner = findUserByEmail(values.email);
  if (owner && owner.id !== userId) {
    throw new MockApiError('Email này đã được tài khoản khác sử dụng.', 409, {
      email: 'Email này đã được tài khoản khác sử dụng.',
    });
  }
  requireUser(userId);
  const updated = updateDb((db) => {
    const user = db.users.find((item) => item.id === userId)!;
    user.fullName = values.fullName.trim();
    user.email = values.email.trim().toLowerCase();
    user.phone = values.phone.trim();
    return user;
  });
  return mockDelay(toSessionUser(updated), 600);
}

/** Lưu tài khoản nhận hoàn tiền. Chỉ chính chủ xem lại được số tài khoản. */
export async function saveBankAccount(
  values: BankAccountFormValues,
  userId: string,
): Promise<BankAccount> {
  if (!USE_MOCK) {
    const { data } = await apiClient.put<ApiResponse<BankAccount>>('/auth/me/bank-account', values);
    return data.data;
  }
  requireUser(userId);
  const account: BankAccount = {
    bankName: values.bankName,
    accountNumber: values.accountNumber,
    accountHolder: values.accountHolder,
  };
  updateDb((db) => {
    db.users.find((item) => item.id === userId)!.bankAccount = account;
  });
  return mockDelay(account, 500);
}

export async function removeBankAccount(userId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.delete('/auth/me/bank-account');
    return;
  }
  updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (user) delete user.bankAccount;
  });
  await mockDelay(null, 400);
}

export async function changePassword(values: ChangePasswordFormValues): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.post('/auth/change-password', values);
    return;
  }
  if (values.currentPassword.length < 8) {
    throw new MockApiError('Mật khẩu hiện tại không đúng.', 401, {
      currentPassword: 'Mật khẩu hiện tại không đúng.',
    });
  }
  await mockDelay(null, 700);
}

export async function fetchMyOrders(userId: string): Promise<Order[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Order[]>>('/orders/me');
    return data.data;
  }
  const orders = readDb()
    .orders.filter((order) => order.userId === userId)
    .map((order) => hydrateOrder(order));
  return mockDelay(orders, 320);
}

/** Ghi sổ địa chỉ vào kho dữ liệu, giữ đúng một địa chỉ mặc định. */
function writeAddresses(userId: string, update: (addresses: Address[]) => Address[]): void {
  updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return;
    const next = update(user.addresses);
    const defaultId = next.find((address) => address.isDefault)?.id ?? next[0]?.id;
    user.addresses = next.map((address) => ({ ...address, isDefault: address.id === defaultId }));
  });
}

export async function saveAddress(
  values: AddressFormValues,
  addressId: string | undefined,
  userId: string,
): Promise<{ id: string }> {
  if (!USE_MOCK) {
    const { data } = addressId
      ? await apiClient.put<ApiResponse<{ id: string }>>(`/addresses/${addressId}`, values)
      : await apiClient.post<ApiResponse<{ id: string }>>('/addresses', values);
    return data.data;
  }
  const id = addressId ?? createId('adr');
  writeAddresses(userId, (addresses) => {
    const address: Address = { id, ...values };
    const exists = addresses.some((item) => item.id === id);
    const merged = exists
      ? addresses.map((item) => (item.id === id ? address : item))
      : [...addresses, address];
    return values.isDefault
      ? merged.map((item) => ({ ...item, isDefault: item.id === id }))
      : merged;
  });
  return mockDelay({ id }, 500);
}

export async function makeDefaultAddress(addressId: string, userId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/addresses/${addressId}/default`);
    return;
  }
  writeAddresses(userId, (addresses) =>
    addresses.map((item) => ({ ...item, isDefault: item.id === addressId })),
  );
  await mockDelay(null, 200);
}

export async function deleteAddress(addressId: string, userId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.delete(`/addresses/${addressId}`);
    return;
  }
  writeAddresses(userId, (addresses) => addresses.filter((item) => item.id !== addressId));
  await mockDelay(null, 400);
}

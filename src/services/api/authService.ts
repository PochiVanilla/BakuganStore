import type { ApiResponse, AuthSession, Order, User } from '@/types';
import type {
  AddressFormValues,
  ChangePasswordFormValues,
  LoginFormValues,
  ProfileFormValues,
  RegisterFormValues,
} from '@/features/auth/schemas';
import { DEMO_ACCOUNT, MOCK_ORDERS, MOCK_USER } from '@/mocks';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';

function makeToken(prefix: string): string {
  return `${prefix}.${btoa(`${Date.now()}`)}.mock-signature`;
}

export async function register(values: RegisterFormValues): Promise<{ email: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ email: string }>>('/auth/register', values);
    return data.data;
  }
  if (values.email.toLowerCase() === DEMO_ACCOUNT.email) {
    throw new MockApiError('Email này đã được đăng ký.', 409, {
      email: 'Email này đã được đăng ký.',
    });
  }
  return mockDelay({ email: values.email }, 700);
}

export async function login(values: LoginFormValues): Promise<AuthSession> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/login', values);
    return data.data;
  }
  if (values.password.length < 8) {
    throw new MockApiError('Email hoặc mật khẩu không đúng.', 401, {
      password: 'Email hoặc mật khẩu không đúng.',
    });
  }
  const isDemo = values.email.toLowerCase() === DEMO_ACCOUNT.email;
  const user: User = isDemo
    ? MOCK_USER
    : {
        ...MOCK_USER,
        id: `usr-${values.email.length}${Date.now() % 1000}`,
        email: values.email,
        fullName: values.email.split('@')[0] ?? 'Người chơi TD',
      };

  return mockDelay(
    { user, accessToken: makeToken('access'), refreshToken: makeToken('refresh') },
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

export async function updateProfile(values: ProfileFormValues): Promise<User> {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch<ApiResponse<User>>('/auth/me', values);
    return data.data;
  }
  return mockDelay({ ...MOCK_USER, ...values }, 600);
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

export async function fetchMyOrders(): Promise<Order[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Order[]>>('/orders/me');
    return data.data;
  }
  return mockDelay(MOCK_ORDERS, 320);
}

export async function saveAddress(
  values: AddressFormValues,
  addressId?: string,
): Promise<{ id: string }> {
  if (!USE_MOCK) {
    const { data } = addressId
      ? await apiClient.put<ApiResponse<{ id: string }>>(`/addresses/${addressId}`, values)
      : await apiClient.post<ApiResponse<{ id: string }>>('/addresses', values);
    return data.data;
  }
  return mockDelay({ id: addressId ?? `adr-${Date.now()}` }, 500);
}

export async function deleteAddress(addressId: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.delete(`/addresses/${addressId}`);
    return;
  }
  await mockDelay(null, 400);
}

import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL, AUTH_TOKEN_KEY, type ApiError } from './client';

/*
 * HTTP client thật (axios) — chỉ được tải khi web nối backend (VITE_USE_MOCK=false).
 * Gắn token đăng nhập vào mỗi request, tự gia hạn phiên khi token hết hạn,
 * và chuẩn hoá lỗi về dạng ApiError.
 */

/** Các đường tự xử lý đăng nhập: gặp 401 ở đây không gia hạn phiên. */
const AUTH_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      fieldErrors?: Record<string, string>;
    }>;
    return {
      status: axiosError.response?.status ?? 0,
      message:
        axiosError.response?.data?.message ??
        (axiosError.code === 'ECONNABORTED'
          ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
          : 'Không kết nối được máy chủ. Vui lòng kiểm tra đường truyền.'),
      fieldErrors: axiosError.response?.data?.fieldErrors,
    };
  }
  if (error instanceof Error) {
    return { status: 0, message: error.message };
  }
  return { status: 0, message: 'Đã có lỗi không xác định xảy ra.' };
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư) — dùng token trong bộ nhớ.
    return useAuthStore.getState().accessToken;
  }
}

export function createHttpClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    // Gia hạn phiên chỉ dựa vào cookie; không gửi kèm access token (có thể đã hết hạn).
    const token = config.url === '/auth/refresh' ? null : readToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  /*
   * Gia hạn phiên: refresh token nằm trong cookie httpOnly, trình duyệt tự gửi kèm.
   * Nhiều request cùng gặp 401 thì chỉ gọi /auth/refresh một lần rồi dùng chung kết quả.
   */
  let refreshing: Promise<string | null> | null = null;
  const refreshAccessToken = (): Promise<string | null> => {
    refreshing ??= client
      .post<ApiResponse<{ user: User; accessToken: string }>>('/auth/refresh')
      .then(({ data }) => {
        useAuthStore.getState().refreshSession(data.data);
        return data.data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };
  const retried = new WeakSet<InternalAxiosRequestConfig>();

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401 && error.config) {
        const config = error.config;
        const isAuthPath = AUTH_PATHS.some((path) => config.url?.startsWith(path));
        if (!isAuthPath && !retried.has(config) && useAuthStore.getState().isAuthenticated) {
          const token = await refreshAccessToken();
          if (token) {
            retried.add(config);
            config.headers.set('Authorization', `Bearer ${token}`);
            return client.request(config);
          }
          // Gia hạn không được (hết hạn, bị thu hồi): đăng xuất ở phía web.
          useAuthStore.getState().expireSession();
        }
      }
      return Promise.reject(toApiError(error));
    },
  );
  return client;
}

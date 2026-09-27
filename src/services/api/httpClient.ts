import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { API_BASE_URL, AUTH_TOKEN_KEY, type ApiError } from './client';

/*
 * HTTP client thật (axios) — chỉ được tải khi web nối backend (VITE_USE_MOCK=false).
 * Gắn token đăng nhập vào mỗi request và chuẩn hoá lỗi về dạng ApiError.
 */

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

export function createHttpClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    try {
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua, request vẫn chạy.
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const apiError = toApiError(error);
      if (apiError.status === 401) {
        try {
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {
          // bỏ qua
        }
      }
      return Promise.reject(apiError);
    },
  );
  return client;
}

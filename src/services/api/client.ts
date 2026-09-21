import axios, { AxiosError, type AxiosInstance } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Bật/tắt chế độ mock. Khi backend TypeScript sẵn sàng:
 * đặt VITE_USE_MOCK=false + VITE_API_BASE_URL -> toàn bộ service
 * tự chuyển sang gọi HTTP thật, không phải sửa component nào.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const AUTH_TOKEN_KEY = 'td-bakugan:access-token';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
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

export interface ApiError {
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

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

apiClient.interceptors.response.use(
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

/** Lỗi nghiệp vụ dùng chung cho tầng mock (giữ đúng hình dạng ApiError). */
export class MockApiError extends Error implements ApiError {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, status = 400, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'MockApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Giả lập độ trễ mạng để skeleton loading hiển thị đúng như thật. */
export function mockDelay<T>(data: T, ms = 320): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(data), ms);
  });
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof MockApiError) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Đã có lỗi xảy ra, vui lòng thử lại.';
}

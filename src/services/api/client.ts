import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Bật/tắt chế độ mock. Khi backend TypeScript sẵn sàng:
 * đặt VITE_USE_MOCK=false + VITE_API_BASE_URL -> toàn bộ service
 * tự chuyển sang gọi HTTP thật, không phải sửa component nào.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const AUTH_TOKEN_KEY = 'td-bakugan:access-token';

export interface ApiError {
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

/*
 * Axios chỉ tải ở lần gọi backend đầu tiên — bản chạy dữ liệu mock không bao giờ
 * cần, nên lần tải trang đầu nhẹ hơn. Cách gọi giữ nguyên như axios:
 * `apiClient.get<ApiResponse<T>>(url, { params })` rồi đọc `data`.
 */
let http: Promise<AxiosInstance> | null = null;

function loadHttp(): Promise<AxiosInstance> {
  http ??= import('./httpClient').then((mod) => mod.createHttpClient());
  return http;
}

export const apiClient = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    loadHttp().then((client) => client.get<T>(url, config)),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    loadHttp().then((client) => client.delete<T>(url, config)),
  post: <T = unknown>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => loadHttp().then((client) => client.post<T>(url, body, config)),
  put: <T = unknown>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => loadHttp().then((client) => client.put<T>(url, body, config)),
  patch: <T = unknown>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => loadHttp().then((client) => client.patch<T>(url, body, config)),
};

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

/**
 * Dữ liệu mock nằm ngay trong trình duyệt nên trả về ngay (vẫn bất đồng bộ như gọi
 * API thật). Trước đây mỗi lần đọc dữ liệu cố tình chờ 150–700ms cho giống mạng thật,
 * làm cả web chậm vô cớ. Muốn xem lại skeleton / trạng thái chờ khi phát triển thì
 * chạy với VITE_MOCK_LATENCY=1.
 */
const SIMULATE_LATENCY = import.meta.env.VITE_MOCK_LATENCY === '1';

export function mockDelay<T>(data: T, ms = 320): Promise<T> {
  if (!SIMULATE_LATENCY) return Promise.resolve(data);
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

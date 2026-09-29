import type { ZodError } from 'zod';

/*
 * Lỗi nghiệp vụ trả về cho web theo đúng hợp đồng: { message, fieldErrors? }.
 * Câu báo lỗi viết cho khách đọc; chi tiết kỹ thuật chỉ nằm trong log.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, fieldErrors?: Record<string, string>): ApiError =>
  new ApiError(400, message, fieldErrors);
export const unauthorized = (message = 'Bạn cần đăng nhập để tiếp tục.'): ApiError =>
  new ApiError(401, message);
export const forbidden = (message = 'Bạn không có quyền làm việc này.'): ApiError =>
  new ApiError(403, message);
export const notFound = (message = 'Không tìm thấy.'): ApiError => new ApiError(404, message);
export const conflict = (message: string, fieldErrors?: Record<string, string>): ApiError =>
  new ApiError(409, message, fieldErrors);
export const unprocessable = (message: string, fieldErrors?: Record<string, string>): ApiError =>
  new ApiError(422, message, fieldErrors);

export const INVALID_INPUT_MESSAGE = 'Thông tin chưa hợp lệ, bạn kiểm tra lại các ô được đánh dấu.';

/** Lỗi đầu tiên của từng ô, khoá là đường dẫn nối bằng dấu chấm (VD "items.0.name"). */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/** Kiểm tra dữ liệu vào bằng Zod; sai thì ném 422 kèm lỗi từng ô. */
export function parseInput<T>(
  schema: {
    safeParse(data: unknown): { success: true; data: T } | { success: false; error: ZodError };
  },
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw unprocessable(INVALID_INPUT_MESSAGE, fieldErrorsFromZod(result.error));
  }
  return result.data;
}

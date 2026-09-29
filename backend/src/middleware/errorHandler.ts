import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, fieldErrorsFromZod, INVALID_INPUT_MESSAGE } from '../lib/errors';

const SERVER_ERROR_MESSAGE = 'Hệ thống đang gặp sự cố, bạn thử lại sau ít phút nhé.';

/** Lỗi do body-parser / http-errors ném ra (JSON hỏng, body quá lớn…) */
interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

function clientErrorMessage(error: HttpLikeError, status: number): string {
  if (error.type === 'entity.parse.failed') return 'Dữ liệu gửi lên không đúng định dạng.';
  if (error.type === 'entity.too.large' || status === 413) return 'Dữ liệu gửi lên quá lớn.';
  if (status === 415) return 'Kiểu dữ liệu gửi lên không được hỗ trợ.';
  return 'Yêu cầu không hợp lệ.';
}

/** Đường dẫn không có trong API → 404 dạng JSON như mọi lỗi khác. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Không tìm thấy đường dẫn này.' });
};

/**
 * Một chỗ duy nhất đổi lỗi thành câu trả lời { message, fieldErrors }.
 * Lỗi không lường trước: ghi log đầy đủ (kèm mã request), khách chỉ nhận câu chung chung.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    res
      .status(error.status)
      .json(
        error.fieldErrors
          ? { message: error.message, fieldErrors: error.fieldErrors }
          : { message: error.message },
      );
    return;
  }
  if (error instanceof ZodError) {
    res
      .status(422)
      .json({ message: INVALID_INPUT_MESSAGE, fieldErrors: fieldErrorsFromZod(error) });
    return;
  }
  const httpError = (typeof error === 'object' && error !== null ? error : {}) as HttpLikeError;
  const status = httpError.status ?? httpError.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ message: clientErrorMessage(httpError, status) });
    return;
  }
  req.log.error({ err: error }, 'Lỗi không lường trước khi xử lý request');
  res.status(500).json({ message: SERVER_ERROR_MESSAGE });
};

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ApiError,
  fieldErrorsFromZod,
  INVALID_INPUT_MESSAGE,
  parseInput,
} from '../../src/lib/errors';

describe('lỗi chuẩn', () => {
  const schema = z.object({
    name: z.string().min(2, 'Nhập tên'),
    items: z.array(z.object({ price: z.number().positive('Giá') })),
  });

  it('gom lỗi từng ô theo đường dẫn nối bằng dấu chấm, giữ lỗi đầu tiên', () => {
    const result = schema.safeParse({ name: 'a', items: [{ price: 1 }, { price: -1 }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error)).toEqual({
        name: 'Nhập tên',
        'items.1.price': 'Giá',
      });
    }
  });

  it('parseInput: đúng thì trả dữ liệu, sai thì ném 422 kèm lỗi từng ô', () => {
    expect(parseInput(schema, { name: 'Drago', items: [] })).toEqual({ name: 'Drago', items: [] });
    try {
      parseInput(schema, { name: '', items: [] });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(422);
      expect((error as ApiError).message).toBe(INVALID_INPUT_MESSAGE);
      expect((error as ApiError).fieldErrors).toEqual({ name: 'Nhập tên' });
    }
  });
});

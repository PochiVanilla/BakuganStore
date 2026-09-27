import { z } from 'zod';
import { PAYMENT_METHODS } from '@/types';
import { emailSchema, fullNameSchema, phoneSchema } from '@/features/auth/schemas';

/* ============================================================
   Validate các biểu mẫu quản trị. Server (mock) kiểm tra lại những
   ràng buộc quan trọng như tồn kho, giá không âm, quyền admin.
   ============================================================ */

const money = (label: string) =>
  z
    .number({ error: `Vui lòng nhập ${label}.` })
    .int(`${label} phải là số nguyên.`)
    .min(0, `${label} không được âm.`)
    .max(1_000_000_000, `${label} quá lớn.`);

/* ---------------- Tạo đơn ---------------- */
export const createOrderSchema = z
  .object({
    customerMode: z.enum(['account', 'guest']),
    customerId: z.string(),
    customerEmail: z.union([z.literal(''), emailSchema]),
    receiverName: fullNameSchema,
    phone: phoneSchema,
    addressLine: z
      .string()
      .trim()
      .min(10, 'Nhập địa chỉ đầy đủ: số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.')
      .max(200, 'Địa chỉ tối đa 200 ký tự.'),
    /** Mỗi con Bakugan là duy nhất nên không có số lượng */
    items: z.array(
      z.object({
        itemId: z.string().min(1),
        price: money('Đơn giá'),
      }),
    ),
    auctionId: z.string(),
    shippingFee: money('Phí ship'),
    discount: money('Giảm giá'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentStatus: z.enum(['unpaid', 'paid']),
    initialStatus: z.enum(['pending', 'confirmed']),
    note: z.string().trim().max(300, 'Ghi chú tối đa 300 ký tự.'),
  })
  .superRefine((values, ctx) => {
    if (values.customerMode === 'account' && !values.customerId) {
      ctx.addIssue({ code: 'custom', path: ['customerId'], message: 'Chọn một khách hàng.' });
    }
    if (!values.auctionId && values.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Thêm ít nhất một con Bakugan.' });
    }
  });

export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

/* ---------------- Hồ sơ khách (admin sửa) ---------------- */
export const customerEditSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: z.union([z.literal(''), phoneSchema]),
  tags: z.string().max(120, 'Tối đa 120 ký tự.'),
  adminNote: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự.'),
});

export type CustomerEditFormValues = z.infer<typeof customerEditSchema>;

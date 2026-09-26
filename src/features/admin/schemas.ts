import { z } from 'zod';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES, PAYMENT_METHODS, PRODUCT_CONDITIONS } from '@/types';
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
    items: z.array(
      z.object({
        productId: z.string().min(1),
        quantity: z
          .number({ error: 'Nhập số lượng.' })
          .int('Số lượng phải là số nguyên.')
          .min(1, 'Tối thiểu 1.'),
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
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Thêm ít nhất một sản phẩm.' });
    }
  });

export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

/* ---------------- Sản phẩm ---------------- */
export const productSchema = z
  .object({
    name: z.string().trim().min(3, 'Tên sản phẩm tối thiểu 3 ký tự.').max(120),
    shortDescription: z
      .string()
      .trim()
      .min(10, 'Mô tả ngắn tối thiểu 10 ký tự.')
      .max(300, 'Mô tả ngắn tối đa 300 ký tự.'),
    attribute: z.enum(BAKUGAN_ATTRIBUTES),
    series: z.enum(BAKUGAN_SERIES),
    condition: z.enum(PRODUCT_CONDITIONS),
    gPower: z
      .number({ error: 'Nhập G-Power.' })
      .int()
      .min(100, 'G-Power từ 100 trở lên.')
      .max(2_000, 'G-Power tối đa 2000.'),
    price: money('Giá bán').min(1_000, 'Giá bán tối thiểu 1.000₫.'),
    /** 0 = không giảm giá */
    originalPrice: money('Giá gốc'),
    stock: z.number({ error: 'Nhập tồn kho.' }).int().min(0, 'Tồn kho không được âm.').max(10_000),
    isFeatured: z.boolean(),
    isRare: z.boolean(),
    isHidden: z.boolean(),
  })
  .refine((values) => values.originalPrice === 0 || values.originalPrice > values.price, {
    path: ['originalPrice'],
    message: 'Giá gốc phải lớn hơn giá bán (để 0 nếu không giảm giá).',
  });

export type ProductFormValues = z.infer<typeof productSchema>;

/* ---------------- Phiếu nhập ---------------- */
export const receiptSchema = z.object({
  supplier: z.string().trim().min(2, 'Nhập tên nhà cung cấp.').max(80),
  receivedAt: z.string().min(1, 'Chọn ngày nhập.'),
  note: z.string().trim().max(300),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Chọn sản phẩm.'),
        quantity: z
          .number({ error: 'Nhập số lượng.' })
          .int('Số lượng phải là số nguyên.')
          .min(1, 'Tối thiểu 1.')
          .max(1_000, 'Tối đa 1000 mỗi dòng.'),
        unitCost: money('Giá vốn'),
      }),
    )
    .min(1, 'Phiếu nhập cần ít nhất một dòng hàng.'),
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;

/* ---------------- Hồ sơ khách (admin sửa) ---------------- */
export const customerEditSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: z.union([z.literal(''), phoneSchema]),
  tags: z.string().max(120, 'Tối đa 120 ký tự.'),
  adminNote: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự.'),
});

export type CustomerEditFormValues = z.infer<typeof customerEditSchema>;

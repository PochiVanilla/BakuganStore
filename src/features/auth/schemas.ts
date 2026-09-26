import { z } from 'zod';

/**
 * Nguồn chân lý duy nhất cho validate tài khoản.
 * Backend TypeScript (Node.js) import lại đúng file này để validate
 * ở tầng server — frontend và backend không bao giờ lệch quy tắc.
 */

/** Regex số di động Việt Nam 10 số. */
export const VN_PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

/** Cho phép chữ cái mọi ngôn ngữ (có dấu tiếng Việt), khoảng trắng, dấu nháy và gạch nối. */
const FULL_NAME_REGEX = /^[\p{L}\p{M}\s'-]+$/u;

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Họ và tên phải có ít nhất 2 ký tự.')
  .max(50, 'Họ và tên tối đa 50 ký tự.')
  .regex(FULL_NAME_REGEX, 'Họ và tên chỉ được chứa chữ cái và khoảng trắng.');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email.')
  .pipe(z.email('Email không đúng định dạng.'));

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập số điện thoại.')
  .regex(VN_PHONE_REGEX, 'Số điện thoại di động Việt Nam không hợp lệ (VD: 0912345678).');

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
  .max(64, 'Mật khẩu tối đa 64 ký tự.')
  .regex(/[A-Z]/, 'Mật khẩu cần có ít nhất 1 chữ in hoa.')
  .regex(/[a-z]/, 'Mật khẩu cần có ít nhất 1 chữ thường.')
  .regex(/\d/, 'Mật khẩu cần có ít nhất 1 chữ số.');

/* ---------------- Đăng ký ---------------- */
export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu.'),
    // Dùng boolean + refine (thay vì z.literal(true)) để React Hook Form
    // có thể nhận defaultValue `false` mà vẫn đúng kiểu.
    agreeToTerms: z
      .boolean()
      .refine(
        (value) => value === true,
        'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật.',
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

/* ---------------- Đăng nhập ---------------- */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/* ---------------- Quên mật khẩu ---------------- */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/* ---------------- Đổi mật khẩu ---------------- */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu nhập lại không khớp.',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    path: ['newPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

/* ---------------- Hồ sơ cá nhân ---------------- */
export const profileSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

/* ---------------- Sổ địa chỉ ---------------- */
export const addressSchema = z.object({
  label: z.string().trim().min(1, 'Vui lòng đặt tên cho địa chỉ (VD: Nhà riêng).').max(30),
  receiverName: fullNameSchema,
  phone: phoneSchema,
  province: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố.'),
  district: z.string().trim().min(1, 'Vui lòng nhập quận/huyện.'),
  ward: z.string().trim().min(1, 'Vui lòng nhập phường/xã.'),
  street: z.string().trim().min(1, 'Vui lòng nhập số nhà, tên đường.'),
  isDefault: z.boolean(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

/* ---------------- Tài khoản nhận hoàn tiền ---------------- */
export const VN_BANKS = [
  'Vietcombank',
  'VietinBank',
  'BIDV',
  'Agribank',
  'Techcombank',
  'MB Bank',
  'ACB',
  'VPBank',
  'Sacombank',
  'TPBank',
  'HDBank',
  'VIB',
  'SHB',
  'OCB',
] as const;

/** "Nguyễn Minh Khôi" -> "NGUYEN MINH KHOI", đúng kiểu tên in trên thẻ. */
export function toAccountHolderName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export const bankAccountSchema = z.object({
  bankName: z.enum(VN_BANKS, 'Vui lòng chọn ngân hàng.'),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,19}$/, 'Số tài khoản gồm 6 – 19 chữ số, không có khoảng trắng.'),
  accountHolder: z
    .string()
    .trim()
    .min(2, 'Vui lòng nhập tên chủ tài khoản.')
    .max(50, 'Tên chủ tài khoản tối đa 50 ký tự.')
    .regex(/^[A-Z ]+$/, 'Tên chủ tài khoản viết in hoa, không dấu, đúng như trên thẻ.'),
});

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

/* ---------------- Độ mạnh mật khẩu ---------------- */
export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong' | 'very-strong';

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  label: string;
  /** 0 – 4, dùng để vẽ thanh tiến độ */
  score: number;
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    number: boolean;
    symbol: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  if (password.length === 0) {
    return { level: 'empty', label: 'Chưa nhập', score: 0, checks };
  }

  const required = [checks.length, checks.upper, checks.lower, checks.number].filter(
    Boolean,
  ).length;
  const bonus = (checks.symbol ? 1 : 0) + (password.length >= 12 ? 1 : 0);
  const score = Math.min(4, Math.max(1, required - 1 + bonus));

  const levels: Record<number, { level: PasswordStrengthLevel; label: string }> = {
    1: { level: 'weak', label: 'Yếu' },
    2: { level: 'medium', label: 'Trung bình' },
    3: { level: 'strong', label: 'Mạnh' },
    4: { level: 'very-strong', label: 'Rất mạnh' },
  };

  const resolved = levels[score] ?? levels[1]!;
  return { ...resolved, score, checks };
}

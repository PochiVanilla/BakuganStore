import { z } from 'zod';

export const passwordStrengthCheck = (password: string) => {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  if (passed <= 1) return 'Yếu';
  if (passed === 2 || passed === 3) return 'Trung bình';
  return 'Mạnh';
};

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự.')
      .max(50, 'Họ và tên tối đa 50 ký tự.')
      .regex(/^[\p{L}\p{M}\s]+$/u, 'Họ và tên chỉ được chứa chữ cái và khoảng trắng.'),
    email: z.string().trim().email('Email không đúng định dạng.'),
    phone: z
      .string()
      .trim()
      .regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, 'Số điện thoại không hợp lệ.'),
    password: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
      .regex(/[A-Z]/, 'Mật khẩu cần có ít nhất 1 chữ hoa.')
      .regex(/[a-z]/, 'Mật khẩu cần có ít nhất 1 chữ thường.')
      .regex(/\d/, 'Mật khẩu cần có ít nhất 1 số.'),
    confirmPassword: z.string(),
    agreeToTerms: z.boolean().refine((value) => value === true, 'Bạn cần đồng ý điều khoản để đăng ký.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

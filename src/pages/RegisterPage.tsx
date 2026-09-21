import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { registerSchema, passwordStrengthCheck, type RegisterFormValues } from '@/features/auth/schemas';

const defaultValues: RegisterFormValues = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false,
};

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues,
  });

  const passwordValue = watch('password');
  const passwordStrength = passwordStrengthCheck(passwordValue || '');

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Register payload', values);
    setIsSubmitting(false);
  };

  const isSubmitDisabled = !isValid || isSubmitting;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid overflow-hidden rounded-[32px] border border-white/10 bg-surface shadow-[0_0_35px_rgba(123,75,232,0.24)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(123,75,232,0.35),_transparent_35%),linear-gradient(135deg,#0f0f17,#14141f)] p-10 lg:block">
          <div className="absolute right-8 top-8 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold">
            NEW
          </div>
          <div className="relative mt-12 flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">
                <Sparkles size={14} />
                Thành viên TD Bakugan
              </div>
              <h1 className="text-4xl font-black leading-tight text-text">
                Tạo tài khoản <span className="text-primary">để săn ưu đãi</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-text-muted">
                Theo dõi đơn hàng, tham gia đấu giá, lưu sản phẩm yêu thích và nhận ưu đãi cho khách sưu tầm mới.
              </p>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-cyan/10 text-accent-cyan">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="font-bold text-text">Bảo mật cao</div>
                  <div className="text-sm text-text-muted">Mật khẩu và thông tin tài khoản được bảo vệ.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Đăng ký</p>
            <h2 className="mt-2 text-3xl font-black text-text">Tạo tài khoản mới</h2>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-text">
                Họ và tên
              </label>
              <input
                id="fullName"
                {...register('fullName')}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-text placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
                placeholder="Nguyễn Văn A"
              />
              {errors.fullName && <p className="mt-2 text-sm text-pink-400">{errors.fullName.message}</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-text">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-text placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="mt-2 text-sm text-pink-400">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-medium text-text">
                  Số điện thoại
                </label>
                <input
                  id="phone"
                  {...register('phone')}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-text placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
                  placeholder="0901234567"
                />
                {errors.phone && <p className="mt-2 text-sm text-pink-400">{errors.phone.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-text">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-12 text-text placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label="Hiện mật khẩu"
                  className="absolute inset-y-0 right-3 flex items-center text-text-muted"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {passwordValue ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                    <span>Độ mạnh mật khẩu</span>
                    <span className="font-bold text-accent-cyan">{passwordStrength}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        passwordStrength === 'Yếu'
                          ? 'w-1/3 bg-red-400'
                          : passwordStrength === 'Trung bình'
                            ? 'w-2/3 bg-yellow-400'
                            : 'w-full bg-green-400'
                      }`}
                    />
                  </div>
                </div>
              ) : null}

              {errors.password && <p className="mt-2 text-sm text-pink-400">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-text">
                Nhập lại mật khẩu
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-12 text-text placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label="Hiện lại mật khẩu"
                  className="absolute inset-y-0 right-3 flex items-center text-text-muted"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-2 text-sm text-pink-400">{errors.confirmPassword.message}</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <label className="flex items-start gap-3 text-sm text-text-muted">
                <input type="checkbox" {...register('agreeToTerms')} className="mt-1 h-4 w-4 accent-primary" />
                <span>
                  Tôi đồng ý với{' '}
                  <a href="#" className="font-semibold text-accent-cyan underline-offset-2 hover:underline">
                    Điều khoản sử dụng
                  </a>{' '}
                  và{' '}
                  <a href="#" className="font-semibold text-accent-cyan underline-offset-2 hover:underline">
                    Chính sách bảo mật
                  </a>
                </span>
              </label>
              {errors.agreeToTerms && <p className="mt-2 text-sm text-pink-400">{errors.agreeToTerms.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full rounded-full bg-gradient-to-r from-primary to-accent-pink px-4 py-3 font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>

            <div className="text-center text-sm text-text-muted">
              Đã có tài khoản?{' '}
              <a href="#" className="font-semibold text-accent-cyan hover:underline">
                Đăng nhập
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

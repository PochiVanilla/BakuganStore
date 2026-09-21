import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Gavel, Heart, Package } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas';
import { login } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { DEMO_ACCOUNT } from '@/mocks';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { Button, Input, PasswordInput, Seo } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';

interface LocationState {
  from?: { pathname: string };
  email?: string;
}

const PERKS = [
  { icon: Gavel, text: 'Đặt giá trong các phiên đấu giá độc quyền' },
  { icon: Package, text: 'Theo dõi trạng thái đơn hàng theo thời gian thực' },
  { icon: Heart, text: 'Đồng bộ danh sách yêu thích trên mọi thiết bị' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const signIn = useAuthStore((store) => store.signIn);
  const isAuthenticated = useAuthStore((store) => store.isAuthenticated);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.email ?? '', password: '', rememberMe: true },
  });

  useEffect(() => {
    if (isAuthenticated) navigate(ROUTES.account, { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    try {
      const session = await login(values);
      signIn(session);
      toast.success(`Chào mừng trở lại, ${session.user.fullName}!`);
      navigate(state?.from?.pathname ?? ROUTES.account, { replace: true });
    } catch (error) {
      const fieldErrors =
        typeof error === 'object' && error !== null && 'fieldErrors' in error
          ? (error as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined;
      if (fieldErrors?.password) {
        setError('password', { type: 'server', message: fieldErrors.password });
      }
      toast.error('Đăng nhập thất bại', getApiErrorMessage(error));
    }
  };

  const fillDemoAccount = (): void => {
    setValue('email', DEMO_ACCOUNT.email, { shouldValidate: true });
    setValue('password', DEMO_ACCOUNT.password, { shouldValidate: true });
  };

  return (
    <>
      <Seo
        title="Đăng nhập"
        description="Đăng nhập tài khoản TD Bakugan để tham gia đấu giá, theo dõi đơn hàng và quản lý danh sách yêu thích."
        path={ROUTES.login}
      />

      <AuthLayout
        title="Đăng nhập"
        subtitle="Chào mừng chiến binh quay lại sàn đấu."
        aside={
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold text-text">Sẵn sàng vào trận?</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
              Đăng nhập để mở khoá toàn bộ tính năng dành cho thành viên TD Bakugan.
            </p>
            <ul className="mt-6 space-y-3.5">
              {PERKS.map((perk) => (
                <li key={perk.text} className="flex items-start gap-3 text-sm text-text-muted">
                  <perk.icon
                    size={16}
                    className="mt-0.5 shrink-0 text-accent-cyan"
                    aria-hidden="true"
                  />
                  {perk.text}
                </li>
              ))}
            </ul>
          </div>
        }
        footer={
          <>
            Chưa có tài khoản?{' '}
            <Link
              to={ROUTES.register}
              className="font-semibold text-accent-cyan hover:text-accent-pink"
            >
              Đăng ký ngay
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="ban@email.com"
            autoComplete="email"
            required
            leftIcon={<Mail size={17} />}
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordInput
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded border-2 border-white/25 bg-surface-2 accent-[#7B4BE8]"
                {...register('rememberMe')}
              />
              Ghi nhớ đăng nhập
            </label>
            <Link
              to={ROUTES.forgotPassword}
              className="text-sm font-medium text-accent-cyan transition hover:text-accent-pink"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} className="mt-1">
            {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>

          <div className="rounded-xl border border-dashed border-gold/30 bg-gold/5 p-3.5">
            <p className="text-xs leading-relaxed text-text-muted">
              <span className="font-semibold text-gold">Bản demo:</span> chưa có backend nên mọi
              email hợp lệ kèm mật khẩu từ 8 ký tự đều đăng nhập được.
            </p>
            <button
              type="button"
              onClick={fillDemoAccount}
              className="mt-2 text-xs font-semibold text-accent-cyan underline-offset-2 hover:underline"
            >
              Điền sẵn tài khoản demo
            </button>
          </div>
        </form>
      </AuthLayout>
    </>
  );
}

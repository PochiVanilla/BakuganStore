import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CircleCheck, TriangleAlert } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/features/auth/schemas';
import { resetPassword } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Button, PasswordInput, Seo } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { PasswordStrengthMeter } from '@/features/auth/PasswordStrengthMeter';

/** Trang mở từ link trong email "Quên mật khẩu": đặt mật khẩu mới. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = async (values: ResetPasswordFormValues): Promise<void> => {
    try {
      const result = await resetPassword(token, values);
      setDoneEmail(result.email);
      toast.success('Đã đặt mật khẩu mới', 'Đăng nhập lại bằng mật khẩu mới nhé.');
    } catch (error) {
      toast.error('Chưa đặt lại được', getApiErrorMessage(error));
    }
  };

  return (
    <>
      <Seo
        title="Đặt lại mật khẩu"
        description="Đặt mật khẩu mới cho tài khoản TD Bakugan."
        path={ROUTES.resetPassword}
        noIndex
      />
      <AuthLayout
        title="Đặt lại mật khẩu"
        subtitle="Chọn mật khẩu mới cho tài khoản của bạn."
        footer={
          <Link
            to={ROUTES.login}
            className="inline-flex items-center gap-1.5 font-semibold text-accent-cyan hover:text-accent-pink"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Quay lại đăng nhập
          </Link>
        }
      >
        {!token ? (
          <div className="text-center">
            <span
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-warning/40 bg-warning/10 text-warning"
              aria-hidden="true"
            >
              <TriangleAlert size={26} />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              Link đặt lại mật khẩu không đầy đủ. Mở lại đúng link trong email, hoặc yêu cầu link
              mới.
            </p>
            <Button className="mt-6" fullWidth onClick={() => navigate(ROUTES.forgotPassword)}>
              Yêu cầu link mới
            </Button>
          </div>
        ) : doneEmail !== null ? (
          <div className="text-center">
            <span
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-success/40 bg-success/10 text-success"
              aria-hidden="true"
            >
              <CircleCheck size={26} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-text">Đã đổi mật khẩu</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Mọi phiên đăng nhập cũ đã được đăng xuất. Đăng nhập lại bằng mật khẩu mới nhé.
            </p>
            <Button
              className="mt-6"
              fullWidth
              onClick={() => navigate(ROUTES.login, { state: { email: doneEmail } })}
            >
              Đăng nhập
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <PasswordInput
              label="Mật khẩu mới"
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
              required
              error={errors.password?.message}
              footer={<PasswordStrengthMeter password={password ?? ''} />}
              {...register('password')}
            />
            <PasswordInput
              label="Nhập lại mật khẩu mới"
              placeholder="Nhập lại mật khẩu ở trên"
              autoComplete="new-password"
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
              {isSubmitting ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
}

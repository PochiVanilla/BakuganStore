import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, CircleCheck, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/features/auth/schemas';
import { requestPasswordReset } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Button, Input, Seo } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues): Promise<void> => {
    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
      toast.success('Đã gửi hướng dẫn', `Kiểm tra hộp thư ${values.email}.`);
    } catch (error) {
      toast.error('Gửi thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <>
      <Seo
        title="Quên mật khẩu"
        description="Khôi phục mật khẩu tài khoản TD Bakugan qua email đã đăng ký."
        path={ROUTES.forgotPassword}
        noIndex
      />

      <AuthLayout
        title="Quên mật khẩu"
        subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu."
        aside={
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold text-text">Lấy lại tài khoản</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
              Liên kết đặt lại mật khẩu có hiệu lực trong 30 phút. Nếu không thấy email, hãy kiểm
              tra thư mục spam hoặc liên hệ hotline của shop.
            </p>
          </div>
        }
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
        {sentTo ? (
          <div className="text-center">
            <span
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-success/40 bg-success/10 text-success"
              aria-hidden="true"
            >
              <CircleCheck size={26} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-text">
              Kiểm tra email của bạn
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu tới{' '}
              <span className="font-semibold text-text">{sentTo}</span>. Liên kết có hiệu lực trong
              30 phút.
            </p>
            <Button variant="secondary" fullWidth className="mt-6" onClick={() => setSentTo(null)}>
              Gửi lại với email khác
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="Email đã đăng ký"
              type="email"
              placeholder="ban@email.com"
              autoComplete="email"
              required
              leftIcon={<Mail size={17} />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
              {isSubmitting ? 'Đang gửi…' : 'Gửi hướng dẫn đặt lại'}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
}

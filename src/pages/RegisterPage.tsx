import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, ShieldCheck, Sparkles, User } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas';
import { register as registerAccount } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Button, Checkbox, Input, Modal, PasswordInput, Seo } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { PasswordStrengthMeter } from '@/features/auth/PasswordStrengthMeter';
import { TermsContent, PrivacyContent } from '@/features/auth/legalContent';

const PERKS = [
  'Đặt giá ở mọi phiên đấu giá của shop',
  'Theo dõi đơn hàng và lịch sử đấu giá',
  'Nhận thông báo sớm khi hàng hiếm về kho',
  'Lưu danh sách yêu thích trên mọi thiết bị',
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<'terms' | 'privacy' | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

  const password = useWatch({ control, name: 'password' });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    try {
      await registerAccount(values);
      toast.success(
        'Đăng ký thành công!',
        'Bạn có thể đăng nhập ngay để bắt đầu sưu tầm và đấu giá.',
      );
      navigate(ROUTES.login, { state: { email: values.email }, replace: true });
    } catch (error) {
      const fieldErrors =
        typeof error === 'object' && error !== null && 'fieldErrors' in error
          ? (error as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined;

      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, message]) => {
          if (field in values) {
            setError(field as keyof RegisterFormValues, { type: 'server', message });
          }
        });
      }
      toast.error('Đăng ký thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <>
      <Seo
        title="Đăng ký thành viên"
        description="Tạo tài khoản TD Bakugan để tham gia đấu giá, theo dõi đơn hàng và nhận thông báo khi hàng hiếm về kho."
        path={ROUTES.register}
      />

      <AuthLayout
        title="Đăng ký thành viên"
        subtitle="Tạo tài khoản để đấu giá, lưu yêu thích và theo dõi đơn hàng của bạn."
        aside={
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold text-text">
              Gia nhập cộng đồng người chơi
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
              Hơn 2.400 đơn hàng đã được giao và hàng chục phiên đấu giá mỗi tháng. Tài khoản TD
              Bakugan mở khoá toàn bộ tính năng của shop.
            </p>
            <ul className="mt-6 space-y-3">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                  {perk}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-2.5 rounded-xl border border-accent-cyan/25 bg-accent-cyan/8 p-4">
              <ShieldCheck size={18} className="shrink-0 text-accent-cyan" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-text-muted">
                Thông tin của bạn được mã hoá và không bao giờ chia sẻ cho bên thứ ba.
              </p>
            </div>
          </div>
        }
        footer={
          <>
            Đã có tài khoản?{' '}
            <Link
              to={ROUTES.login}
              className="font-semibold text-accent-cyan hover:text-accent-pink"
            >
              Đăng nhập
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input
            label="Họ và tên"
            placeholder="Nguyễn Văn An"
            autoComplete="name"
            required
            leftIcon={<User size={17} />}
            error={errors.fullName?.message}
            {...register('fullName')}
          />

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

          <Input
            label="Số điện thoại"
            type="tel"
            inputMode="numeric"
            placeholder="0912345678"
            autoComplete="tel"
            required
            leftIcon={<Phone size={17} />}
            hint="Số di động Việt Nam 10 số, dùng để liên hệ giao hàng."
            error={errors.phone?.message}
            {...register('phone')}
          />

          <PasswordInput
            label="Mật khẩu"
            placeholder="Tối thiểu 8 ký tự"
            autoComplete="new-password"
            required
            error={errors.password?.message}
            footer={<PasswordStrengthMeter password={password ?? ''} />}
            {...register('password')}
          />

          <PasswordInput
            label="Nhập lại mật khẩu"
            placeholder="Nhập lại mật khẩu ở trên"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Checkbox
            error={errors.agreeToTerms?.message}
            label={
              <>
                Tôi đồng ý với{' '}
                <button
                  type="button"
                  onClick={() => setOpenModal('terms')}
                  className="font-semibold text-accent-cyan underline-offset-2 hover:underline"
                >
                  Điều khoản sử dụng
                </button>{' '}
                và{' '}
                <button
                  type="button"
                  onClick={() => setOpenModal('privacy')}
                  className="font-semibold text-accent-cyan underline-offset-2 hover:underline"
                >
                  Chính sách bảo mật
                </button>{' '}
                của TD Bakugan.
              </>
            }
            {...register('agreeToTerms')}
          />

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={!isValid}
            isLoading={isSubmitting}
            className="mt-1"
          >
            {isSubmitting ? 'Đang tạo tài khoản…' : 'Đăng ký'}
          </Button>
        </form>
      </AuthLayout>

      <Modal
        isOpen={openModal === 'terms'}
        onClose={() => setOpenModal(null)}
        title="Điều khoản sử dụng"
        description="Cập nhật lần cuối: tháng 9/2026"
      >
        <TermsContent />
      </Modal>

      <Modal
        isOpen={openModal === 'privacy'}
        onClose={() => setOpenModal(null)}
        title="Chính sách bảo mật"
        description="Cập nhật lần cuối: tháng 9/2026"
      >
        <PrivacyContent />
      </Modal>
    </>
  );
}

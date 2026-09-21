import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/features/auth/schemas';
import { changePassword } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Button, PasswordInput } from '@/components/ui';
import { PasswordStrengthMeter } from '@/features/auth/PasswordStrengthMeter';

export function ChangePasswordTab() {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const newPassword = useWatch({ control, name: 'newPassword' });

  const onSubmit = async (values: ChangePasswordFormValues): Promise<void> => {
    try {
      await changePassword(values);
      reset();
      toast.success('Đã đổi mật khẩu', 'Lần đăng nhập tới hãy dùng mật khẩu mới nhé.');
    } catch (error) {
      const fieldErrors =
        typeof error === 'object' && error !== null && 'fieldErrors' in error
          ? (error as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined;
      if (fieldErrors?.currentPassword) {
        setError('currentPassword', { type: 'server', message: fieldErrors.currentPassword });
      }
      toast.error('Đổi mật khẩu thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-text">Đổi mật khẩu</h2>
      <p className="mt-1.5 text-sm text-text-muted">
        Nên đổi mật khẩu định kỳ và không dùng lại mật khẩu của website khác.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 flex max-w-lg flex-col gap-4"
      >
        <PasswordInput
          label="Mật khẩu hiện tại"
          autoComplete="current-password"
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordInput
          label="Mật khẩu mới"
          autoComplete="new-password"
          required
          error={errors.newPassword?.message}
          footer={<PasswordStrengthMeter password={newPassword ?? ''} />}
          {...register('newPassword')}
        />
        <PasswordInput
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          required
          error={errors.confirmNewPassword?.message}
          {...register('confirmNewPassword')}
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!isValid}
          leftIcon={<ShieldCheck size={16} />}
          className="self-start"
        >
          Cập nhật mật khẩu
        </Button>
      </form>
    </section>
  );
}

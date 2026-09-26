import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, User } from 'lucide-react';
import { profileSchema, type ProfileFormValues } from '@/features/auth/schemas';
import { updateProfile } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { formatDate } from '@/utils/format';
import { Button, Input } from '@/components/ui';
import { BankAccountSection } from './BankAccountSection';

export function ProfileTab() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
  });

  const onSubmit = async (values: ProfileFormValues): Promise<void> => {
    if (!user) return;
    try {
      const updated = await updateProfile(values, user.id);
      updateUser({ fullName: updated.fullName, email: updated.email, phone: updated.phone });
      toast.success('Đã lưu thông tin cá nhân');
    } catch (error) {
      toast.error('Lưu thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-text">Thông tin cá nhân</h2>
      <p className="mt-1.5 text-sm text-text-muted">
        Thông tin này dùng để liên hệ và giao hàng. Thành viên từ{' '}
        {user ? formatDate(user.createdAt) : '—'}.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 flex max-w-lg flex-col gap-4"
      >
        <Input
          label="Họ và tên"
          required
          leftIcon={<User size={17} />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="Email"
          type="email"
          required
          leftIcon={<Mail size={17} />}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Số điện thoại"
          type="tel"
          inputMode="numeric"
          required
          leftIcon={<Phone size={17} />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Button type="submit" isLoading={isSubmitting} disabled={!isDirty} className="self-start">
          Lưu thay đổi
        </Button>
      </form>

      <BankAccountSection />
    </section>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Landmark, LockKeyhole, Pencil, Trash2 } from 'lucide-react';
import {
  bankAccountSchema,
  toAccountHolderName,
  VN_BANKS,
  type BankAccountFormValues,
} from '@/features/auth/schemas';
import { removeBankAccount, saveBankAccount } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { Button, Input, Select } from '@/components/ui';

/** "0071000123456" -> "•••• 3456" */
function maskAccountNumber(value: string): string {
  return `•••• ${value.slice(-4)}`;
}

const BANK_OPTIONS = [
  { value: '', label: 'Chọn ngân hàng' },
  ...VN_BANKS.map((bank) => ({ value: bank, label: bank })),
];

/**
 * Tài khoản nhận hoàn tiền khi đơn bị huỷ sau thanh toán hoặc khi đổi trả.
 * Chỉ chủ tài khoản thấy được (và cũng chỉ thấy 4 số cuối); trang quản trị
 * chỉ biết tên ngân hàng, không bao giờ nhận được số tài khoản.
 */
export function BankAccountSection() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const account = user?.bankAccount;
  const [isEditing, setIsEditing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankName: account?.bankName as BankAccountFormValues['bankName'] | undefined,
      // Không điền sẵn số tài khoản cũ — muốn đổi thì nhập lại toàn bộ.
      accountNumber: '',
      accountHolder: account?.accountHolder ?? toAccountHolderName(user?.fullName ?? ''),
    },
  });

  if (!user) return null;

  const onSubmit = async (values: BankAccountFormValues): Promise<void> => {
    try {
      const saved = await saveBankAccount(values, user.id);
      updateUser({ bankAccount: saved });
      toast.success('Đã lưu tài khoản nhận hoàn tiền');
      setIsEditing(false);
      reset({ ...values, accountNumber: '' });
    } catch (error) {
      toast.error('Lưu thất bại', getApiErrorMessage(error));
    }
  };

  const handleRemove = async (): Promise<void> => {
    setIsRemoving(true);
    try {
      await removeBankAccount(user.id);
      updateUser({ bankAccount: undefined });
      toast.info('Đã gỡ tài khoản ngân hàng');
    } catch (error) {
      toast.error('Gỡ thất bại', getApiErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <section className="mt-10 border-t border-white/8 pt-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-text">
        <Landmark size={18} className="text-accent-cyan" aria-hidden="true" />
        Tài khoản nhận hoàn tiền
      </h2>
      <p className="mt-1.5 max-w-xl text-sm text-text-muted">
        Dùng khi đơn đã thanh toán bị huỷ hoặc được đổi trả. Không bắt buộc.
      </p>
      <p className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-accent-cyan/20 bg-accent-cyan/5 p-3 text-xs leading-relaxed text-text-muted">
        <LockKeyhole size={14} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
        Số tài khoản chỉ hiển thị với bạn. Nhân viên shop chỉ thấy tên ngân hàng, việc hoàn tiền do
        hệ thống thanh toán xử lý.
      </p>

      {account && !isEditing ? (
        <div className="mt-5 flex max-w-lg flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface-2/60 p-4">
          <div>
            <p className="text-sm font-semibold text-text">{account.bankName}</p>
            <p className="mt-0.5 font-mono text-sm tracking-wider text-text-muted">
              {maskAccountNumber(account.accountNumber)}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{account.accountHolder}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Pencil size={14} aria-hidden="true" />}
              onClick={() => setIsEditing(true)}
            >
              Thay đổi
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={isRemoving}
              leftIcon={<Trash2 size={14} aria-hidden="true" />}
              onClick={() => void handleRemove()}
            >
              Gỡ
            </Button>
          </div>
        </div>
      ) : account || isEditing ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-5 flex max-w-lg flex-col gap-4"
        >
          <Select
            label="Ngân hàng"
            required
            options={BANK_OPTIONS}
            error={errors.bankName?.message}
            {...register('bankName')}
          />
          <Input
            label="Số tài khoản"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="Chỉ gồm chữ số"
            error={errors.accountNumber?.message}
            {...register('accountNumber')}
          />
          <Input
            label="Tên chủ tài khoản"
            required
            autoComplete="off"
            hint="Viết in hoa, không dấu — hệ thống tự chuyển khi bạn gõ."
            error={errors.accountHolder?.message}
            {...register('accountHolder', {
              setValueAs: (value: string) => toAccountHolderName(value),
            })}
          />
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>
              Lưu tài khoản
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Huỷ
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          className="mt-5"
          leftIcon={<Landmark size={16} aria-hidden="true" />}
          onClick={() => setIsEditing(true)}
        >
          Thêm tài khoản ngân hàng
        </Button>
      )}
    </section>
  );
}

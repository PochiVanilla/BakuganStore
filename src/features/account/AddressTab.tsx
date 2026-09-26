import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import type { Address } from '@/types';
import { addressSchema, type AddressFormValues } from '@/features/auth/schemas';
import { deleteAddress, makeDefaultAddress, saveAddress } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { Button, Checkbox, EmptyState, Input, Modal } from '@/components/ui';

const EMPTY_FORM: AddressFormValues = {
  label: '',
  receiverName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  street: '',
  isDefault: false,
};

export function AddressTab() {
  const user = useAuthStore((state) => state.user);
  const upsertAddress = useAuthStore((state) => state.upsertAddress);
  const removeAddress = useAuthStore((state) => state.removeAddress);
  const setDefaultAddress = useAuthStore((state) => state.setDefaultAddress);

  const [editing, setEditing] = useState<Address | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY_FORM,
  });

  const addresses = user?.addresses ?? [];

  const openCreate = (): void => {
    setEditing(null);
    reset(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (address: Address): void => {
    setEditing(address);
    reset({
      label: address.label,
      receiverName: address.receiverName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      ward: address.ward,
      street: address.street,
      isDefault: address.isDefault,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (values: AddressFormValues): Promise<void> => {
    try {
      if (!user) return;
      const result = await saveAddress(values, editing?.id, user.id);
      upsertAddress({ id: result.id, ...values });
      toast.success(editing ? 'Đã cập nhật địa chỉ' : 'Đã thêm địa chỉ mới');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Lưu địa chỉ thất bại', getApiErrorMessage(error));
    }
  };

  const handleDelete = async (address: Address): Promise<void> => {
    try {
      if (!user) return;
      await deleteAddress(address.id, user.id);
      removeAddress(address.id);
      toast.info('Đã xoá địa chỉ', address.label);
    } catch (error) {
      toast.error('Xoá thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-text">Sổ địa chỉ</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Lưu sẵn địa chỉ để đặt hàng nhanh hơn ở những lần sau.
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
          Thêm địa chỉ
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MapPin size={26} aria-hidden="true" />}
            title="Chưa có địa chỉ nào"
            description="Thêm địa chỉ giao hàng để không phải nhập lại mỗi lần đặt hàng."
            action={<Button onClick={openCreate}>Thêm địa chỉ đầu tiên</Button>}
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={cn(
                'rounded-2xl border p-5 transition',
                address.isDefault
                  ? 'border-accent-cyan/45 bg-accent-cyan/6'
                  : 'border-white/8 bg-surface/70',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-display text-sm font-bold text-text">
                    {address.label}
                    {address.isDefault && (
                      <span className="rounded-md border border-accent-cyan/45 bg-accent-cyan/12 px-1.5 py-0.5 text-[10px] font-bold text-accent-cyan">
                        MẶC ĐỊNH
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 text-sm text-text">{address.receiverName}</p>
                  <p className="text-sm text-text-muted">{address.phone}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                    {address.street}, {address.ward}, {address.district}, {address.province}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultAddress(address.id);
                      toast.success('Đã đặt làm địa chỉ mặc định');
                      if (user) {
                        makeDefaultAddress(address.id, user.id).catch((error: unknown) =>
                          toast.error('Chưa lưu được lên máy chủ', getApiErrorMessage(error)),
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-gold/45 hover:text-gold"
                  >
                    <Star size={13} aria-hidden="true" />
                    Đặt mặc định
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent-cyan/45 hover:text-accent-cyan"
                >
                  <Pencil size={13} aria-hidden="true" />
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(address)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-danger/45 hover:text-danger"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
        size="md"
      >
        <form
          id="address-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Input
            label="Tên địa chỉ"
            placeholder="Nhà riêng / Văn phòng"
            required
            error={errors.label?.message}
            {...register('label')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Người nhận"
              required
              error={errors.receiverName?.message}
              {...register('receiverName')}
            />
            <Input
              label="Số điện thoại"
              type="tel"
              inputMode="numeric"
              required
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Tỉnh/Thành phố"
              required
              error={errors.province?.message}
              {...register('province')}
            />
            <Input
              label="Quận/Huyện"
              required
              error={errors.district?.message}
              {...register('district')}
            />
            <Input label="Phường/Xã" required error={errors.ward?.message} {...register('ward')} />
          </div>
          <Input
            label="Số nhà, tên đường"
            required
            error={errors.street?.message}
            {...register('street')}
          />
          <Checkbox label="Đặt làm địa chỉ mặc định" {...register('isDefault')} />

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" isLoading={isSubmitting}>
              {editing ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Huỷ
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

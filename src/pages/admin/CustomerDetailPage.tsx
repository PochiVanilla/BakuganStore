import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  KeyRound,
  Landmark,
  LockKeyhole,
  MapPin,
  Pencil,
  PlusCircle,
  ShieldCheck,
  UnlockKeyhole,
} from 'lucide-react';
import type { AdminCustomerDetail, Gender } from '@/types';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import {
  getCustomer,
  sendPasswordReset,
  setCustomerRole,
  setCustomerStatus,
  updateCustomer,
} from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, ButtonLink, Input, Modal, Seo, Skeleton, Textarea } from '@/components/ui';
import {
  AdminPageHeader,
  ErrorBox,
  InfoRow,
  OrderStatusBadge,
  Panel,
  StatCard,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';
import { initials } from '@/features/admin/adminFormat';
import { customerEditSchema, type CustomerEditFormValues } from '@/features/admin/schemas';

const GENDER_LABELS: Record<Gender, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

function EditCustomerModal({
  customer,
  onClose,
}: {
  customer: AdminCustomerDetail;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerEditFormValues>({
    resolver: zodResolver(customerEditSchema),
    defaultValues: {
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      tags: customer.tags.join(', '),
      adminNote: customer.adminNote,
    },
  });

  const onSubmit = async (values: CustomerEditFormValues): Promise<void> => {
    try {
      await updateCustomer(customer.id, {
        ...values,
        tags: values.tags.split(','),
      });
      toast.success('Đã cập nhật hồ sơ khách');
      onClose();
    } catch (error) {
      const fieldErrors =
        typeof error === 'object' && error !== null && 'fieldErrors' in error
          ? (error as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined;
      if (fieldErrors?.email) setError('email', { type: 'server', message: fieldErrors.email });
      toast.error('Không lưu được', getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Sửa hồ sơ khách"
      description="Mật khẩu và số tài khoản ngân hàng chỉ khách tự đổi được."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="customer-form" isLoading={isSubmitting}>
            Lưu
          </Button>
        </div>
      }
    >
      <form
        id="customer-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <Input
          label="Họ và tên"
          required
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="Số điện thoại"
          type="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Input
          label="Email đăng nhập"
          type="email"
          required
          containerClassName="sm:col-span-2"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Thẻ phân loại"
          containerClassName="sm:col-span-2"
          hint="Cách nhau bằng dấu phẩy, VD: VIP, Sưu tầm, Khách quen"
          error={errors.tags?.message}
          {...register('tags')}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Ghi chú nội bộ"
            rows={3}
            className="min-h-24"
            hint="Khách không bao giờ thấy nội dung này."
            error={errors.adminNote?.message}
            {...register('adminNote')}
          />
        </div>
      </form>
    </Modal>
  );
}

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  const revision = useLiveRevision();
  const currentAdminId = useAuthStore((state) => state.user?.id);
  const {
    data: customer,
    error,
    reload,
  } = useAsync(() => getCustomer(id), [id, revision], {
    keepPreviousData: true,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [dialog, setDialog] = useState<'lock' | 'role' | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockError, setLockError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  if (error && !customer) {
    return (
      <>
        <Link
          to={ADMIN_ROUTES.customers}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Danh sách khách
        </Link>
        <ErrorBox message={error} onRetry={reload} />
      </>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 xl:col-span-2" />
        </div>
      </div>
    );
  }

  const isSelf = customer.id === currentAdminId;
  const isLocked = customer.status === 'locked';

  const run = async (key: string, action: () => Promise<void>): Promise<void> => {
    setBusy(key);
    try {
      await action();
    } catch (actionError) {
      toast.error('Không thực hiện được', getApiErrorMessage(actionError));
    } finally {
      setBusy(null);
    }
  };

  const confirmLock = (): void => {
    if (!isLocked && lockReason.trim().length < 5) {
      setLockError('Ghi lý do khoá (ít nhất 5 ký tự) để lưu vết.');
      return;
    }
    void run('lock', async () => {
      await setCustomerStatus(customer.id, isLocked ? 'active' : 'locked', lockReason);
      toast.success(isLocked ? 'Đã mở khoá tài khoản' : 'Đã khoá tài khoản', customer.fullName);
      setDialog(null);
      setLockReason('');
      setLockError(undefined);
    });
  };

  return (
    <>
      <Seo title={customer.fullName} description="Hồ sơ khách hàng" noIndex />
      <Link
        to={ADMIN_ROUTES.customers}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Danh sách khách
      </Link>

      <AdminPageHeader
        title={customer.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {customer.role === 'admin' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                <ShieldCheck size={12} aria-hidden="true" /> Quản trị viên
              </span>
            )}
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                isLocked
                  ? 'border-danger/40 bg-danger/10 text-danger'
                  : 'border-success/40 bg-success/10 text-success',
              )}
            >
              {isLocked ? 'Đã khoá' : 'Đang hoạt động'}
            </span>
            {customer.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-white/6 px-2 py-0.5 text-[11px] font-semibold text-text-muted"
              >
                {tag}
              </span>
            ))}
          </span>
        }
        actions={
          <>
            <ButtonLink
              to={`${ADMIN_ROUTES.createOrder}?customer=${customer.id}`}
              size="sm"
              variant="secondary"
              leftIcon={<PlusCircle size={15} aria-hidden="true" />}
            >
              Tạo đơn cho khách
            </ButtonLink>
            <Button
              size="sm"
              leftIcon={<Pencil size={15} aria-hidden="true" />}
              onClick={() => setIsEditing(true)}
            >
              Sửa hồ sơ
            </Button>
          </>
        }
      />

      {isLocked && customer.lockedReason && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/8 p-4 text-sm text-danger">
          <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Lý do khoá: {customer.lockedReason}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Tổng chi tiêu"
          value={formatCurrency(customer.stats.totalSpent)}
          hint="Không tính đơn huỷ, hoàn"
        />
        <StatCard
          label="Số đơn"
          value={customer.stats.orderCount}
          hint={`${customer.stats.completedCount} hoàn tất · ${customer.stats.cancelledCount} huỷ`}
        />
        <StatCard
          label="Đơn gần nhất"
          value={customer.stats.lastOrderAt ? formatRelativeTime(customer.stats.lastOrderAt) : '—'}
        />
        <StatCard
          label="Đấu giá"
          value={`${customer.stats.auctionBidCount} lượt`}
          hint={`Thắng ${customer.stats.auctionWinCount} phiên`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Hồ sơ">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 font-bold text-primary-soft">
                {initials(customer.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-text">{customer.fullName}</p>
                <p className="text-xs text-text-muted">Mã: {customer.id}</p>
              </div>
            </div>
            <dl className="divide-y divide-white/5">
              <InfoRow label="Email">{customer.email}</InfoRow>
              <InfoRow label="Điện thoại">
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="text-accent-cyan hover:underline">
                    {customer.phone}
                  </a>
                ) : (
                  '—'
                )}
              </InfoRow>
              <InfoRow label="Giới tính">
                {customer.gender ? GENDER_LABELS[customer.gender] : '—'}
              </InfoRow>
              <InfoRow label="Ngày sinh">
                {customer.birthday ? formatDate(customer.birthday) : '—'}
              </InfoRow>
              <InfoRow label="Tham gia">{formatDate(customer.createdAt)}</InfoRow>
              <InfoRow label="Đăng nhập gần nhất">
                {customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : '—'}
              </InfoRow>
            </dl>
            {customer.adminNote && (
              <p className="mt-3 rounded-xl border border-white/8 bg-surface-2/60 p-3 text-sm text-text-muted">
                <span className="font-semibold text-text">Ghi chú nội bộ:</span>{' '}
                {customer.adminNote}
              </p>
            )}
          </Panel>

          <Panel title="Tài khoản ngân hàng">
            {customer.bankLink ? (
              <dl className="divide-y divide-white/5">
                <InfoRow label="Ngân hàng">{customer.bankLink.bankName}</InfoRow>
                <InfoRow label="Chủ tài khoản">{customer.bankLink.accountHolder}</InfoRow>
                <InfoRow label="Số tài khoản">
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <LockKeyhole size={13} aria-hidden="true" /> Được ẩn để bảo mật
                  </span>
                </InfoRow>
              </dl>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Landmark size={15} aria-hidden="true" /> Khách chưa thêm tài khoản nhận hoàn tiền.
              </p>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Hệ thống không gửi số tài khoản về trang quản trị. Khi cần hoàn tiền, bộ phận thanh
              toán xử lý trực tiếp với ngân hàng.
            </p>
          </Panel>

          <Panel title={`Sổ địa chỉ (${customer.addresses.length})`}>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-text-muted">Chưa có địa chỉ nào.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="flex gap-2.5 text-sm">
                    <MapPin
                      size={15}
                      className="mt-0.5 shrink-0 text-accent-cyan"
                      aria-hidden="true"
                    />
                    <span>
                      <span className="font-medium text-text">
                        {address.label}
                        {address.isDefault && (
                          <span className="ml-1.5 text-xs text-gold">(mặc định)</span>
                        )}
                      </span>
                      <span className="block text-text-muted">
                        {address.receiverName} · {address.phone}
                      </span>
                      <span className="block text-text-muted">
                        {address.street}, {address.ward}, {address.district}, {address.province}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Bảo mật & quyền">
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                isLoading={busy === 'reset'}
                leftIcon={<KeyRound size={15} aria-hidden="true" />}
                onClick={() =>
                  void run('reset', async () => {
                    const { email } = await sendPasswordReset(customer.id);
                    toast.success('Đã gửi link đặt lại mật khẩu', email);
                  })
                }
              >
                Gửi link đặt lại mật khẩu
              </Button>
              <Button
                variant={isLocked ? 'outline' : 'danger'}
                size="sm"
                disabled={isSelf}
                leftIcon={
                  isLocked ? (
                    <UnlockKeyhole size={15} aria-hidden="true" />
                  ) : (
                    <LockKeyhole size={15} aria-hidden="true" />
                  )
                }
                onClick={() => setDialog('lock')}
              >
                {isLocked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSelf}
                leftIcon={<ShieldCheck size={15} aria-hidden="true" />}
                onClick={() => setDialog('role')}
              >
                {customer.role === 'admin' ? 'Thu hồi quyền quản trị' : 'Cấp quyền quản trị'}
              </Button>
              {isSelf && (
                <p className="text-xs text-text-muted">
                  Đây là tài khoản của bạn — không thể tự khoá hay đổi quyền.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Panel title={`Đơn hàng (${customer.orders.length})`} bodyClassName="p-0">
            {customer.orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                Khách chưa có đơn nào.
              </p>
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Mã đơn</th>
                    <th className={th}>Sản phẩm</th>
                    <th className={cn(th, 'text-right')}>Tổng tiền</th>
                    <th className={th}>Trạng thái</th>
                    <th className={th}>Ngày đặt</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-white/3">
                      <td className={td}>
                        <Link
                          to={ADMIN_ROUTES.orderDetail(order.id)}
                          className="font-mono font-semibold text-accent-cyan hover:underline"
                        >
                          #{order.code}
                        </Link>
                      </td>
                      <td className={cn(td, 'text-text-muted')}>
                        <span className="block max-w-64 truncate">
                          {order.items.map((item) => item.name).join(', ')}
                        </span>
                      </td>
                      <td className={cn(td, 'text-right font-semibold tabular-nums')}>
                        {formatCurrency(order.total)}
                      </td>
                      <td className={td}>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className={cn(td, 'text-xs whitespace-nowrap text-text-muted')}>
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Panel>

          <Panel title={`Tham gia đấu giá (${customer.auctions.length})`} bodyClassName="p-0">
            {customer.auctions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                Khách chưa đặt giá phiên nào.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {customer.auctions.map((entry) => (
                  <li
                    key={entry.auctionId}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <Link
                      to={ROUTES.auctionDetail(entry.auctionId)}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-text hover:text-accent-cyan"
                    >
                      {entry.title}
                    </Link>
                    <span className="text-xs text-text-muted">{entry.bidCount} lượt</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(entry.myHighestBid)}
                    </span>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                        entry.isWinning
                          ? 'bg-success/12 text-success'
                          : 'bg-white/6 text-text-muted',
                      )}
                    >
                      {entry.isWinning
                        ? entry.status === 'ended'
                          ? 'Thắng phiên'
                          : 'Đang dẫn đầu'
                        : entry.status === 'ended'
                          ? 'Không thắng'
                          : 'Bị vượt'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {isEditing && <EditCustomerModal customer={customer} onClose={() => setIsEditing(false)} />}

      <Modal
        isOpen={dialog === 'lock'}
        onClose={() => setDialog(null)}
        title={isLocked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}
        description={customer.fullName}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Huỷ
            </Button>
            <Button
              variant={isLocked ? 'primary' : 'danger'}
              isLoading={busy === 'lock'}
              onClick={confirmLock}
            >
              {isLocked ? 'Mở khoá' : 'Khoá tài khoản'}
            </Button>
          </div>
        }
      >
        {isLocked ? (
          <p>Khách sẽ đăng nhập, đặt hàng và đấu giá lại được bình thường.</p>
        ) : (
          <>
            <p className="mb-3">
              Khách sẽ không đăng nhập được cho tới khi mở khoá. Đơn đang xử lý vẫn giữ nguyên.
            </p>
            <Textarea
              label="Lý do khoá"
              name="lock-reason"
              required
              rows={2}
              className="min-h-20 text-sm"
              value={lockReason}
              error={lockError}
              maxLength={200}
              onChange={(event) => setLockReason(event.target.value)}
            />
          </>
        )}
      </Modal>

      <Modal
        isOpen={dialog === 'role'}
        onClose={() => setDialog(null)}
        title={customer.role === 'admin' ? 'Thu hồi quyền quản trị' : 'Cấp quyền quản trị'}
        description={customer.fullName}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Huỷ
            </Button>
            <Button
              variant={customer.role === 'admin' ? 'danger' : 'gold'}
              isLoading={busy === 'role'}
              onClick={() =>
                void run('role', async () => {
                  const nextRole = customer.role === 'admin' ? 'customer' : 'admin';
                  await setCustomerRole(customer.id, nextRole);
                  toast.success(
                    nextRole === 'admin' ? 'Đã cấp quyền quản trị' : 'Đã thu hồi quyền quản trị',
                  );
                  setDialog(null);
                })
              }
            >
              Xác nhận
            </Button>
          </div>
        }
      >
        {customer.role === 'admin' ? (
          <p>Tài khoản này sẽ không vào được trang quản trị nữa.</p>
        ) : (
          <p>
            Tài khoản này sẽ vào được toàn bộ trang quản trị: xem khách hàng, đơn hàng, sửa kho. Chỉ
            cấp cho nhân viên bạn tin tưởng.
          </p>
        )}
      </Modal>
    </>
  );
}

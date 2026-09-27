import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, Hourglass, Landmark, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import type { AccountStatus, AdminCustomer, UserRole } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import { LEVEL_SOURCE_LABELS, PURCHASES_FOR_LV2 } from '@/constants/catalog';
import { listCustomers, type CustomerQuery } from '@/services/api/admin';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { EmptyState, Seo, Skeleton } from '@/components/ui';
import {
  AdminPageHeader,
  CompactSelect,
  ErrorBox,
  FilterTabs,
  SearchField,
  StatCard,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';
import { initials, isWithinDays } from '@/features/admin/adminFormat';

const SORT_OPTIONS: ReadonlyArray<{ value: NonNullable<CustomerQuery['sort']>; label: string }> = [
  { value: 'recent', label: 'Đăng nhập gần đây' },
  { value: 'spent', label: 'Chi tiêu nhiều nhất' },
  { value: 'orders', label: 'Nhiều đơn nhất' },
  { value: 'name', label: 'Tên A → Z' },
];

const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole | 'all'; label: string }> = [
  { value: 'customer', label: 'Khách hàng' },
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'all', label: 'Mọi vai trò' },
];

/** Lọc theo hạng, giữ trên URL (?hang=requests) để trang tổng quan dẫn thẳng tới. */
type LevelFilter = 'all' | 'lv1' | 'lv2' | 'requests';
const LEVEL_PARAM = 'hang';

function toLevelQuery(filter: LevelFilter): CustomerQuery['level'] {
  if (filter === 'lv1') return 1;
  if (filter === 'lv2') return 2;
  return filter;
}

function readLevelFilter(value: string | null): LevelFilter {
  return value === 'lv1' || value === 'lv2' || value === 'requests' ? value : 'all';
}

/** Hạng của khách + yêu cầu lên Lv2 đang chờ (nếu có). */
function LevelCell({ customer }: { customer: AdminCustomer }) {
  if (customer.role !== 'customer') return <span className="text-xs text-text-muted/60">—</span>;
  const pending = customer.pendingLevelRequest;
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        title={customer.levelSource ? LEVEL_SOURCE_LABELS[customer.levelSource] : undefined}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold',
          customer.memberLevel >= 2
            ? 'border-gold/40 bg-gold/10 text-gold'
            : 'border-white/12 bg-white/4 text-text-muted',
        )}
      >
        <Award size={11} aria-hidden="true" /> Lv{customer.memberLevel}
      </span>
      {pending ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
          <Hourglass size={11} aria-hidden="true" />
          {pending.kind === 'deposit'
            ? `Báo nạp ${formatCurrency(pending.amount ?? 0)}`
            : 'Xin duyệt lên Lv2'}
        </span>
      ) : (
        customer.memberLevel < 2 && (
          <span className="text-[11px] text-text-muted">
            Đã mua {customer.stats.purchasedItemCount}/{PURCHASES_FOR_LV2} con
          </span>
        )
      )}
    </div>
  );
}

export default function CustomersPage() {
  const revision = useLiveRevision();
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<AccountStatus | 'all'>('all');
  const [role, setRole] = useState<UserRole | 'all'>('customer');
  const [sort, setSort] = useState<NonNullable<CustomerQuery['sort']>>('recent');
  const debouncedKeyword = useDebouncedValue(keyword, 250);
  const levelFilter = readLevelFilter(params.get(LEVEL_PARAM));

  const setLevelFilter = (next: LevelFilter): void => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === 'all') updated.delete(LEVEL_PARAM);
        else updated.set(LEVEL_PARAM, next);
        return updated;
      },
      { replace: true },
    );
  };

  const list = useAsync(
    () =>
      listCustomers({
        keyword: debouncedKeyword,
        status,
        role,
        sort,
        level: toLevelQuery(levelFilter),
      }),
    [debouncedKeyword, status, role, sort, levelFilter, revision],
    { keepPreviousData: true },
  );
  // Số liệu tổng không phụ thuộc bộ lọc
  const all = useAsync(() => listCustomers({ role: 'customer' }), [revision], {
    keepPreviousData: true,
  });

  const customers = list.data ?? [];
  const everyone = all.data ?? [];
  const members = everyone.filter((item) => item.memberLevel >= 2).length;
  const waiting = everyone.filter((item) => item.pendingLevelRequest).length;

  return (
    <>
      <Seo
        title="Khách hàng"
        description="Quản lý tài khoản khách hàng"
        path={ADMIN_ROUTES.customers}
        noIndex
      />
      <AdminPageHeader
        title="Khách hàng"
        description={
          <span className="flex items-start gap-1.5">
            <LockKeyhole
              size={14}
              className="mt-0.5 shrink-0 text-accent-cyan"
              aria-hidden="true"
            />
            Xem và chỉnh tài khoản khách. Số tài khoản ngân hàng của khách được hệ thống giữ kín,
            trang quản trị không bao giờ nhận được.
          </span>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {all.data ? (
          <>
            <StatCard
              label="Tổng khách hàng"
              value={everyone.length}
              icon={<Users size={16} />}
              hint={`+${everyone.filter((item) => isWithinDays(item.createdAt, 30)).length} đăng ký trong 30 ngày`}
            />
            <StatCard
              label="Thành viên Lv2"
              value={members}
              icon={<Award size={16} />}
              hint="Được tham gia đấu giá"
            />
            <StatCard
              label="Chờ duyệt lên Lv2"
              value={waiting}
              icon={<Hourglass size={16} />}
              tone={waiting > 0 ? 'warning' : 'default'}
              hint={waiting > 0 ? 'Bấm tab “Chờ duyệt Lv2” để xử lý' : 'Không có yêu cầu mới'}
            />
            <StatCard
              label="Đang bị khoá"
              value={everyone.filter((item) => item.status === 'locked').length}
              tone={everyone.some((item) => item.status === 'locked') ? 'warning' : 'default'}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-2xl" />
          ))
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <FilterTabs
          label="Lọc theo hạng thành viên"
          value={levelFilter}
          onChange={setLevelFilter}
          tabs={[
            { value: 'all', label: 'Mọi hạng' },
            {
              value: 'lv1',
              label: 'Lv1',
              count: all.data ? everyone.length - members : undefined,
            },
            { value: 'lv2', label: 'Lv2', count: all.data ? members : undefined },
            { value: 'requests', label: 'Chờ duyệt Lv2', count: all.data ? waiting : undefined },
          ]}
        />
        <FilterTabs
          label="Lọc theo trạng thái"
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'all', label: 'Tất cả' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'locked', label: 'Đã khoá' },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchField
            label="Tìm khách hàng"
            value={keyword}
            onChange={setKeyword}
            placeholder="Tên, email, số điện thoại, thẻ (VIP…)"
            className="flex-1"
          />
          <CompactSelect
            label="Vai trò"
            value={role}
            onChange={setRole}
            options={ROLE_OPTIONS}
            className="sm:w-44"
          />
          <CompactSelect
            label="Sắp xếp"
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            className="sm:w-52"
          />
        </div>
      </div>

      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}

      <div
        className={cn(
          'rounded-2xl border border-white/8 bg-surface/80',
          list.isLoading && list.data && 'opacity-60',
        )}
      >
        {!list.data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Users size={26} aria-hidden="true" />}
              title={
                levelFilter === 'requests'
                  ? 'Không có yêu cầu lên Lv2 nào đang chờ'
                  : 'Không tìm thấy khách hàng nào'
              }
            />
          </div>
        ) : (
          <TableShell className="rounded-2xl">
            <thead>
              <tr>
                <th className={th}>Khách hàng</th>
                <th className={th}>Hạng</th>
                <th className={th}>Điện thoại</th>
                <th className={cn(th, 'text-right')}>Đơn</th>
                <th className={cn(th, 'text-right')}>Tổng chi tiêu</th>
                <th className={th}>Đăng nhập</th>
                <th className={th}>Ngân hàng</th>
                <th className={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="transition hover:bg-white/3">
                  <td className={td}>
                    <Link
                      to={ADMIN_ROUTES.customerDetail(customer.id)}
                      className="group flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary-soft">
                        {initials(customer.fullName)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium text-text group-hover:text-accent-cyan">
                          <span className="max-w-48 truncate">{customer.fullName}</span>
                          {customer.role === 'admin' && (
                            <ShieldCheck
                              size={14}
                              className="text-gold"
                              aria-label="Quản trị viên"
                            />
                          )}
                        </span>
                        <span className="block max-w-56 truncate text-xs text-text-muted">
                          {customer.email}
                        </span>
                      </span>
                    </Link>
                    {customer.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-12">
                        {customer.tags.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              'rounded-md px-1.5 py-px text-[10px] font-semibold',
                              tag === 'VIP' ? 'bg-gold/15 text-gold' : 'bg-white/6 text-text-muted',
                            )}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    <LevelCell customer={customer} />
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-text-muted')}>
                    {customer.phone || '—'}
                  </td>
                  <td className={cn(td, 'text-right tabular-nums')}>
                    {customer.stats.orderCount}
                    {customer.stats.cancelledCount > 0 && (
                      <span className="block text-[11px] text-text-muted">
                        {customer.stats.cancelledCount} huỷ
                      </span>
                    )}
                  </td>
                  <td className={cn(td, 'text-right font-semibold tabular-nums')}>
                    {formatCurrency(customer.stats.totalSpent)}
                  </td>
                  <td className={cn(td, 'text-xs whitespace-nowrap text-text-muted')}>
                    {customer.lastLoginAt ? formatRelativeTime(customer.lastLoginAt) : '—'}
                    <span className="block">Từ {formatDate(customer.createdAt)}</span>
                  </td>
                  <td className={cn(td, 'text-xs')}>
                    {customer.bankLink ? (
                      <span className="inline-flex items-center gap-1 text-text-muted">
                        <Landmark size={13} aria-hidden="true" />
                        {customer.bankLink.bankName}
                      </span>
                    ) : (
                      <span className="text-text-muted/60">Chưa liên kết</span>
                    )}
                  </td>
                  <td className={td}>
                    {customer.status === 'locked' ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                        <LockKeyhole size={11} aria-hidden="true" /> Đã khoá
                      </span>
                    ) : (
                      <span className="rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                        Hoạt động
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>
    </>
  );
}

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, PlusCircle, ShoppingBag } from 'lucide-react';
import type { OrderSource } from '@/types';
import { ORDER_SOURCES, ORDER_STATUSES } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import {
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SHORT_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
} from '@/constants/orders';
import { listOrders, type OrderStatusFilter } from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
import { Button, ButtonLink, EmptyState, Pagination, Seo, Skeleton } from '@/components/ui';
import {
  AdminPageHeader,
  CompactSelect,
  ErrorBox,
  FilterTabs,
  OrderStatusBadge,
  SearchField,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';

const STATUS_FILTERS: readonly OrderStatusFilter[] = ['all', 'active', ...ORDER_STATUSES];
const FILTER_LABELS: Record<OrderStatusFilter, string> = {
  all: 'Tất cả',
  active: 'Cần xử lý',
  ...ORDER_STATUS_LABELS,
};

function isStatusFilter(value: string | null): value is OrderStatusFilter {
  return STATUS_FILTERS.includes(value as OrderStatusFilter);
}

const SOURCE_OPTIONS: ReadonlyArray<{ value: OrderSource | 'all'; label: string }> = [
  { value: 'all', label: 'Mọi nguồn' },
  ...ORDER_SOURCES.map((source) => ({ value: source, label: ORDER_SOURCE_LABELS[source] })),
];

const DAY_OPTIONS = [
  { value: '0', label: 'Mọi thời điểm' },
  { value: '7', label: '7 ngày qua' },
  { value: '30', label: '30 ngày qua' },
  { value: '90', label: '90 ngày qua' },
] as const;
type DayOption = (typeof DAY_OPTIONS)[number]['value'];

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status: OrderStatusFilter = isStatusFilter(rawStatus) ? rawStatus : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [keyword, setKeyword] = useState(params.get('q') ?? '');
  const [source, setSource] = useState<OrderSource | 'all'>('all');
  const [days, setDays] = useState<DayOption>('0');
  const [isExporting, setIsExporting] = useState(false);
  const debouncedKeyword = useDebouncedValue(keyword, 250);
  const revision = useLiveRevision();

  const query = { status, source, keyword: debouncedKeyword, days: Number(days), page };
  const { data, isLoading, error, reload } = useAsync(
    () => listOrders(query),
    [status, source, debouncedKeyword, days, page, revision],
    { keepPreviousData: true },
  );

  const updateParams = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    });
    setParams(next, { replace: true });
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const all = await listOrders({ ...query, page: 1, pageSize: 10_000 });
      downloadCsv(
        `don-hang-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Mã đơn',
          'Ngày đặt',
          'Khách nhận',
          'Điện thoại',
          'Địa chỉ',
          'Sản phẩm',
          'Tạm tính',
          'Phí ship',
          'Giảm giá',
          'Tổng tiền',
          'Thanh toán',
          'Tình trạng thanh toán',
          'Nguồn',
          'Trạng thái',
        ],
        all.page.items.map((order) => [
          order.code,
          formatDateTime(order.createdAt),
          order.receiverName,
          order.phone,
          order.addressLine,
          order.items.map((item) => `${item.name} x${item.quantity}`).join('; '),
          order.subtotal,
          order.shippingFee,
          order.discount,
          order.total,
          PAYMENT_METHOD_LABELS[order.paymentMethod],
          PAYMENT_STATUS_LABELS[order.paymentStatus],
          ORDER_SOURCE_LABELS[order.source],
          ORDER_STATUS_LABELS[order.status],
        ]),
      );
      toast.success('Đã xuất file CSV', `${all.page.total} đơn hàng`);
    } catch (exportError) {
      toast.error('Xuất file thất bại', getApiErrorMessage(exportError));
    } finally {
      setIsExporting(false);
    }
  };

  const orders = data?.page.items ?? [];

  return (
    <>
      <Seo
        title="Quản lý đơn hàng"
        description="Danh sách đơn hàng"
        path={ADMIN_ROUTES.orders}
        noIndex
      />

      <AdminPageHeader
        title="Đơn hàng"
        description="Theo dõi và cập nhật trạng thái mọi đơn: đặt trên web, thắng đấu giá hoặc admin tạo."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              isLoading={isExporting}
              leftIcon={<Download size={15} aria-hidden="true" />}
              onClick={() => void handleExport()}
            >
              Xuất CSV
            </Button>
            <ButtonLink
              to={ADMIN_ROUTES.createOrder}
              size="sm"
              leftIcon={<PlusCircle size={15} aria-hidden="true" />}
            >
              Tạo đơn
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <FilterTabs
          label="Lọc theo trạng thái"
          value={status}
          onChange={(value) => updateParams({ status: value === 'all' ? null : value, page: null })}
          tabs={STATUS_FILTERS.map((value) => ({
            value,
            label: FILTER_LABELS[value],
            count: data?.counts[value],
          }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchField
            label="Tìm đơn hàng"
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              updateParams({ q: value, page: null });
            }}
            placeholder="Mã đơn, tên khách, số điện thoại, tên sản phẩm…"
            className="flex-1"
          />
          <CompactSelect
            label="Nguồn đơn"
            value={source}
            onChange={(value) => {
              setSource(value);
              updateParams({ page: null });
            }}
            options={SOURCE_OPTIONS}
            className="sm:w-44"
          />
          <CompactSelect
            label="Khoảng thời gian"
            value={days}
            onChange={(value) => {
              setDays(value);
              updateParams({ page: null });
            }}
            options={DAY_OPTIONS}
            className="sm:w-44"
          />
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div
        className={cn(
          'rounded-2xl border border-white/8 bg-surface/80',
          isLoading && data && 'opacity-60 transition-opacity',
        )}
      >
        {!data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ShoppingBag size={26} aria-hidden="true" />}
              title="Không có đơn nào khớp bộ lọc"
              description="Thử đổi trạng thái, nguồn đơn hoặc từ khoá tìm kiếm."
            />
          </div>
        ) : (
          <TableShell className="rounded-2xl">
            <thead>
              <tr>
                <th className={th}>Mã đơn</th>
                <th className={th}>Khách nhận</th>
                <th className={th}>Sản phẩm</th>
                <th className={cn(th, 'text-right')}>Tổng tiền</th>
                <th className={th}>Thanh toán</th>
                <th className={th}>Nguồn</th>
                <th className={th}>Trạng thái</th>
                <th className={th}>Ngày đặt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="transition hover:bg-white/3">
                  <td className={td}>
                    <Link
                      to={ADMIN_ROUTES.orderDetail(order.id)}
                      className="font-mono font-semibold text-accent-cyan hover:underline"
                    >
                      #{order.code}
                    </Link>
                  </td>
                  <td className={td}>
                    <p className="max-w-40 truncate whitespace-nowrap">{order.receiverName}</p>
                    <p className="text-xs text-text-muted">{order.phone}</p>
                  </td>
                  <td className={td}>
                    <p className="max-w-56 truncate text-text-muted">
                      {order.items[0]?.name}
                      {order.items.length > 1 && (
                        <span className="text-text"> +{order.items.length - 1}</span>
                      )}
                    </p>
                  </td>
                  <td className={cn(td, 'text-right font-semibold tabular-nums')}>
                    {formatCurrency(order.total)}
                  </td>
                  <td className={td}>
                    <p className="text-xs whitespace-nowrap text-text-muted">
                      {PAYMENT_METHOD_SHORT_LABELS[order.paymentMethod]}
                    </p>
                    <p
                      className={cn(
                        'text-xs font-medium whitespace-nowrap',
                        PAYMENT_STATUS_STYLES[order.paymentStatus],
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </p>
                  </td>
                  <td className={cn(td, 'text-xs whitespace-nowrap text-text-muted')}>
                    {ORDER_SOURCE_LABELS[order.source]}
                  </td>
                  <td className={td}>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className={cn(td, 'text-xs whitespace-nowrap text-text-muted')}>
                    {formatDate(order.createdAt)}
                    <span className="block text-text-muted/70">{formatTime(order.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      {data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            {data.page.total} đơn · trang {data.page.page}/{data.page.totalPages}
          </p>
          <Pagination
            page={data.page.page}
            totalPages={data.page.totalPages}
            onChange={(next) => updateParams({ page: String(next) })}
          />
        </div>
      )}
    </>
  );
}

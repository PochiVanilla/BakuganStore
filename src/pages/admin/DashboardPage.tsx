import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  Gavel,
  MessagesSquare,
  PlusCircle,
  ShoppingBag,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { ORDER_STATUSES } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ORDER_STATUS_LABELS } from '@/constants/orders';
import { getDashboardStats, listInventory, listOrders } from '@/services/api/admin';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/utils/format';
import {
  formatAxisMoney,
  formatDayLabel,
  RANGE_PRESETS,
  type RangePreset,
} from '@/features/admin/adminFormat';
import { ButtonLink, Seo, Skeleton } from '@/components/ui';
import {
  AdminPageHeader,
  ErrorBox,
  FilterTabs,
  OrderStatusBadge,
  Panel,
  StatCard,
} from '@/features/admin/adminUi';
import { BarList, ColumnChart } from '@/features/admin/charts';
import { cn } from '@/utils/cn';

function ratio(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

function TodoTile({
  to,
  icon: Icon,
  label,
  count,
  hint,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count: number;
  hint: string;
}) {
  const urgent = count > 0;
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border p-3.5 transition',
        urgent
          ? 'border-accent-pink/30 bg-accent-pink/5 hover:border-accent-pink/60'
          : 'border-white/8 bg-surface/60 hover:border-white/20',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          urgent ? 'bg-accent-pink/15 text-accent-pink' : 'bg-white/5 text-text-muted',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg leading-tight font-semibold text-text">{count}</span>
        <span className="block text-xs leading-snug text-text-muted">{label}</span>
      </span>
      <span className="sr-only">{hint}</span>
      <ArrowRight
        size={16}
        className="shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-text"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangePreset>('30');
  const revision = useLiveRevision();
  const days = Number(range);

  const stats = useAsync(() => getDashboardStats(days), [days, revision], {
    keepPreviousData: true,
  });
  const recent = useAsync(() => listOrders({ pageSize: 6 }), [revision], {
    keepPreviousData: true,
  });
  const stock = useAsync(() => listInventory({ sort: 'stock-asc' }), [revision], {
    keepPreviousData: true,
  });

  const data = stats.data;
  const lowStock = (stock.data?.rows ?? []).filter((row) => row.level !== 'in-stock').slice(0, 6);

  return (
    <>
      <Seo
        title="Bảng điều khiển"
        description="Tổng quan cửa hàng"
        path={ADMIN_ROUTES.dashboard}
        noIndex
      />

      <AdminPageHeader
        title="Bảng điều khiển"
        description={`Số liệu ${days} ngày gần nhất, tự cập nhật khi có đơn hoặc tin nhắn mới.`}
        actions={
          <>
            <FilterTabs
              label="Khoảng thời gian"
              tabs={RANGE_PRESETS}
              value={range}
              onChange={setRange}
            />
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

      {stats.error && <ErrorBox message={stats.error} onRetry={stats.reload} />}

      {/* Số liệu chính */}
      <div
        className={cn(
          'grid grid-cols-2 gap-3 xl:grid-cols-4',
          stats.isLoading && data && 'opacity-60 transition-opacity',
        )}
      >
        {data ? (
          <>
            <StatCard
              label="Doanh thu"
              value={formatCurrency(data.revenue)}
              delta={ratio(data.revenue, data.previousRevenue)}
              deltaLabel={`so với ${days} ngày trước`}
              hint="Không tính đơn huỷ và hoàn trả"
            />
            <StatCard
              label="Số đơn"
              value={formatNumber(data.orderCount)}
              delta={ratio(data.orderCount, data.previousOrderCount)}
              deltaLabel={`so với ${days} ngày trước`}
            />
            <StatCard
              label="Tỉ lệ huỷ"
              value={`${(data.cancelRate * 100).toFixed(1).replace('.', ',')}%`}
              tone={data.cancelRate > 0.15 ? 'warning' : 'default'}
              hint={`${data.statusCounts.cancelled} đơn bị huỷ`}
            />
            <StatCard
              label="Khách hàng"
              value={formatNumber(data.customerCount)}
              hint={`+${data.newCustomers} tài khoản mới trong kỳ`}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[106px] rounded-2xl" />
          ))
        )}
      </div>

      {/* Việc cần làm */}
      <h2 className="mt-8 mb-3 text-sm font-semibold text-text">Việc cần xử lý</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TodoTile
          to={`${ADMIN_ROUTES.orders}?status=active`}
          icon={ShoppingBag}
          label="Đơn chờ xác nhận / đóng gói"
          count={data?.pendingOrders ?? 0}
          hint="Mở danh sách đơn cần xử lý"
        />
        <TodoTile
          to={ADMIN_ROUTES.auctions}
          icon={Gavel}
          label="Phiên thắng chờ tạo đơn"
          count={data?.awaitingAuctionOrders ?? 0}
          hint="Mở trang đơn đấu giá"
        />
        <TodoTile
          to={ADMIN_ROUTES.chat}
          icon={MessagesSquare}
          label="Tin nhắn chờ nhân viên"
          count={data?.waitingChats ?? 0}
          hint="Mở hộp tin nhắn"
        />
        <TodoTile
          to={ADMIN_ROUTES.problems}
          icon={TriangleAlert}
          label="Sự cố chưa xử lý xong"
          count={data?.openIssues ?? 0}
          hint="Mở báo cáo sự cố"
        />
        <TodoTile
          to={`${ADMIN_ROUTES.inventory}?level=low`}
          icon={Boxes}
          label="Mẫu sắp hết / hết hàng"
          count={(data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0)}
          hint="Mở kho hàng"
        />
      </div>

      {/* Biểu đồ */}
      <div className="mt-8 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Doanh thu 14 ngày gần nhất"
          description="Theo ngày đặt đơn, không tính đơn huỷ và hoàn trả"
          className="xl:col-span-2"
        >
          {data ? (
            <ColumnChart
              caption="Doanh thu theo ngày trong 14 ngày gần nhất"
              data={data.daily.map((point) => ({
                key: point.date,
                ...formatDayLabel(point.date),
                value: point.revenue,
                detail: `${point.orders} đơn`,
              }))}
              formatValue={formatCurrency}
              formatTick={formatAxisMoney}
            />
          ) : (
            <Skeleton className="h-60 w-full" />
          )}
        </Panel>

        <Panel title="Đơn theo trạng thái" description={`Đơn tạo trong ${days} ngày`}>
          {data ? (
            <BarList
              caption="Số đơn theo trạng thái"
              data={ORDER_STATUSES.map((status) => ({
                key: status,
                label: ORDER_STATUS_LABELS[status],
                textLabel: ORDER_STATUS_LABELS[status],
                value: data.statusCounts[status],
                display: formatNumber(data.statusCounts[status]),
              }))}
            />
          ) : (
            <Skeleton className="h-60 w-full" />
          )}
        </Panel>
      </div>

      {/* Danh sách nhanh */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Đơn mới nhất"
          className="xl:col-span-2"
          bodyClassName="p-0"
          actions={
            <Link
              to={ADMIN_ROUTES.orders}
              className="text-xs font-medium text-accent-cyan hover:underline"
            >
              Xem tất cả
            </Link>
          }
        >
          {recent.data ? (
            <ul className="divide-y divide-white/5">
              {recent.data.page.items.map((order) => (
                <li key={order.id}>
                  <Link
                    to={ADMIN_ROUTES.orderDetail(order.id)}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-white/3"
                  >
                    <span className="w-28 font-mono text-sm font-semibold text-text">
                      #{order.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                      {order.receiverName}
                    </span>
                    <span className="text-sm font-semibold text-text tabular-nums">
                      {formatCurrency(order.total)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                    <span className="w-24 text-right text-xs text-text-muted">
                      {formatRelativeTime(order.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Sắp hết hàng"
          description={
            stock.data ? `Còn từ ${stock.data.summary.threshold} con trở xuống` : undefined
          }
          bodyClassName="p-0"
          actions={
            <Link
              to={`${ADMIN_ROUTES.inventory}?level=low`}
              className="text-xs font-medium text-accent-cyan hover:underline"
            >
              Mở kho
            </Link>
          }
        >
          {stock.data ? (
            lowStock.length > 0 ? (
              <ul className="divide-y divide-white/5">
                {lowStock.map(({ product, level }) => (
                  <li key={product.id} className="flex items-center gap-3 px-5 py-2.5">
                    <img
                      src={product.images[0]}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-text">
                      {product.name}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        level === 'out' ? 'text-danger' : 'text-warning',
                      )}
                    >
                      {level === 'out' ? 'Hết hàng' : `Còn ${product.stock}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                Không có mẫu nào sắp hết.
              </p>
            )
          ) : (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

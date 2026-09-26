import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, Hand, TriangleAlert } from 'lucide-react';
import type { Order, OrderIssue } from '@/types';
import { CANCEL_REASONS, ISSUE_TYPES } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import {
  CANCEL_REASON_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/constants/orders';
import { getProblemReport, updateIssue } from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
import { Button, Modal, Seo, Skeleton, Textarea } from '@/components/ui';
import {
  AdminPageHeader,
  ErrorBox,
  FilterTabs,
  IssueStatusBadge,
  Panel,
  StatCard,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';
import { BarList } from '@/features/admin/charts';
import { formatPercent, RANGE_PRESETS, type RangePreset } from '@/features/admin/adminFormat';

const REPORTER_LABELS: Record<OrderIssue['reportedBy'], string> = {
  customer: 'Khách báo',
  carrier: 'Vận chuyển báo',
  admin: 'Nhân viên ghi nhận',
};

type IssueFilter = 'open' | 'resolved' | 'all';

function OrderTable({ orders, kind }: { orders: Order[]; kind: 'cancelled' | 'returned' }) {
  if (orders.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">Không có đơn nào trong kỳ.</p>
    );
  }
  return (
    <TableShell>
      <thead>
        <tr>
          <th className={th}>Mã đơn</th>
          <th className={th}>Khách</th>
          <th className={cn(th, 'text-right')}>Giá trị</th>
          <th className={th}>{kind === 'cancelled' ? 'Lý do' : 'Hoàn tiền'}</th>
          <th className={th}>Ngày</th>
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
            <td className={cn(td, 'whitespace-nowrap')}>{order.receiverName}</td>
            <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(order.total)}</td>
            <td className={td}>
              {kind === 'cancelled' ? (
                <>
                  <p>{order.cancelReason ? CANCEL_REASON_LABELS[order.cancelReason] : '—'}</p>
                  {order.cancelNote && (
                    <p className="max-w-72 truncate text-xs text-text-muted">{order.cancelNote}</p>
                  )}
                </>
              ) : (
                <span
                  className={
                    order.paymentStatus === 'refunded' ? 'text-text-muted' : 'text-warning'
                  }
                >
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </span>
              )}
            </td>
            <td className={cn(td, 'text-xs whitespace-nowrap text-text-muted')}>
              {formatDate(order.updatedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export default function ProblemsPage() {
  const revision = useLiveRevision();
  const [range, setRange] = useState<RangePreset>('30');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('open');
  const [resolving, setResolving] = useState<OrderIssue | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolutionError, setResolutionError] = useState<string>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const days = Number(range);

  const { data, isLoading, error, reload } = useAsync(
    () => getProblemReport(days),
    [days, revision],
    {
      keepPreviousData: true,
    },
  );

  const issues = (data?.issues ?? []).filter((issue) => {
    if (issueFilter === 'open') return issue.status !== 'resolved';
    if (issueFilter === 'resolved') return issue.status === 'resolved';
    return true;
  });

  const takeIssue = async (issue: OrderIssue): Promise<void> => {
    setBusyId(issue.id);
    try {
      await updateIssue(issue.id, { status: 'investigating' });
      toast.info('Đã nhận xử lý sự cố', `Đơn #${issue.orderCode}`);
    } catch (takeError) {
      toast.error('Không cập nhật được', getApiErrorMessage(takeError));
    } finally {
      setBusyId(null);
    }
  };

  const resolveIssue = async (): Promise<void> => {
    if (!resolving) return;
    if (resolution.trim().length < 5) {
      setResolutionError('Ghi lại ngắn gọn cách đã xử lý (ít nhất 5 ký tự).');
      return;
    }
    setBusyId(resolving.id);
    try {
      await updateIssue(resolving.id, { status: 'resolved', resolution });
      toast.success('Đã đóng sự cố', `Đơn #${resolving.orderCode}`);
      setResolving(null);
      setResolution('');
      setResolutionError(undefined);
    } catch (resolveError) {
      toast.error('Không đóng được sự cố', getApiErrorMessage(resolveError));
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = (): void => {
    if (!data) return;
    const header = [
      'Loại',
      'Mã đơn',
      'Khách',
      'Giá trị',
      'Lý do / loại sự cố',
      'Trạng thái',
      'Ghi chú',
      'Ngày',
    ];
    const rows: Array<Array<string | number>> = [
      ...data.cancelled.map((order) => [
        'Đơn huỷ',
        order.code,
        order.receiverName,
        order.total,
        order.cancelReason ? CANCEL_REASON_LABELS[order.cancelReason] : '',
        'Đã huỷ',
        order.cancelNote ?? '',
        formatDateTime(order.updatedAt),
      ]),
      ...data.returned.map((order) => [
        'Hoàn trả',
        order.code,
        order.receiverName,
        order.total,
        '',
        PAYMENT_STATUS_LABELS[order.paymentStatus],
        '',
        formatDateTime(order.updatedAt),
      ]),
      ...data.issues.map((issue) => [
        'Sự cố',
        issue.orderCode,
        issue.customerName,
        '',
        ISSUE_TYPE_LABELS[issue.type],
        ISSUE_STATUS_LABELS[issue.status],
        [issue.description, issue.resolution].filter(Boolean).join(' | '),
        formatDateTime(issue.createdAt),
      ]),
    ];
    downloadCsv(`bao-cao-huy-su-co-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  };

  return (
    <>
      <Seo
        title="Huỷ đơn & sự cố"
        description="Báo cáo đơn huỷ và sự cố"
        path={ADMIN_ROUTES.problems}
        noIndex
      />
      <AdminPageHeader
        title="Huỷ đơn & sự cố"
        description="Báo cáo đơn bị huỷ, hoàn trả và các trục trặc khi giao hàng, thanh toán."
        actions={
          <>
            <FilterTabs
              label="Khoảng thời gian"
              tabs={RANGE_PRESETS}
              value={range}
              onChange={setRange}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!data}
              leftIcon={<Download size={15} aria-hidden="true" />}
              onClick={exportCsv}
            >
              Xuất CSV
            </Button>
          </>
        }
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div
        className={cn('grid grid-cols-2 gap-3 xl:grid-cols-4', isLoading && data && 'opacity-60')}
      >
        {data ? (
          <>
            <StatCard
              label="Đơn bị huỷ"
              value={data.cancelled.length}
              hint={`${formatPercent(data.cancelRate)} trên ${data.orderCount} đơn`}
              tone={data.cancelRate > 0.15 ? 'warning' : 'default'}
            />
            <StatCard label="Đơn hoàn trả" value={data.returned.length} />
            <StatCard
              label="Giá trị không thu được"
              value={formatCurrency(data.lostRevenue)}
              hint="Tổng tiền đơn huỷ và hoàn"
            />
            <StatCard
              label="Sự cố chưa xong"
              value={data.openIssueCount}
              tone={data.openIssueCount > 0 ? 'danger' : 'default'}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-2xl" />
          ))
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Lý do huỷ đơn" description={`Đơn tạo trong ${days} ngày`}>
          {data ? (
            <BarList
              caption="Số đơn huỷ theo lý do"
              emptyText="Không có đơn huỷ nào trong kỳ."
              data={CANCEL_REASONS.map((reason) => ({
                key: reason,
                label: CANCEL_REASON_LABELS[reason],
                textLabel: CANCEL_REASON_LABELS[reason],
                value: data.byReason[reason],
                display: String(data.byReason[reason]),
              }))}
            />
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Panel>
        <Panel title="Loại sự cố" description="Sự cố trong kỳ và sự cố chưa xử lý xong">
          {data ? (
            <BarList
              caption="Số sự cố theo loại"
              emptyText="Chưa có sự cố nào."
              data={ISSUE_TYPES.map((type) => ({
                key: type,
                label: ISSUE_TYPE_LABELS[type],
                textLabel: ISSUE_TYPE_LABELS[type],
                value: data.issuesByType[type],
                display: String(data.issuesByType[type]),
              }))}
            />
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Panel>
      </div>

      <Panel
        title="Sự cố đơn hàng"
        className="mt-4"
        bodyClassName="p-0"
        actions={
          <FilterTabs
            label="Lọc sự cố"
            value={issueFilter}
            onChange={setIssueFilter}
            tabs={[
              { value: 'open', label: 'Chưa xong', count: data?.openIssueCount },
              { value: 'resolved', label: 'Đã giải quyết' },
              { value: 'all', label: 'Tất cả' },
            ]}
          />
        }
      >
        {!data ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : issues.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-text-muted">
            <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
            Không có sự cố nào ở mục này.
          </p>
        ) : (
          <ul className="divide-y divide-white/6">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-warning">
                  <TriangleAlert size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text">{ISSUE_TYPE_LABELS[issue.type]}</span>
                    <IssueStatusBadge status={issue.status} />
                    <Link
                      to={ADMIN_ROUTES.orderDetail(issue.orderId)}
                      className="font-mono text-xs font-semibold text-accent-cyan hover:underline"
                    >
                      #{issue.orderCode}
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{issue.description}</p>
                  {issue.resolution && (
                    <p className="mt-1 text-sm text-success">Cách xử lý: {issue.resolution}</p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    {issue.customerName} · {REPORTER_LABELS[issue.reportedBy]} ·{' '}
                    {formatRelativeTime(issue.createdAt)}
                  </p>
                </div>
                {issue.status !== 'resolved' && (
                  <div className="flex shrink-0 gap-2">
                    {issue.status === 'open' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={busyId === issue.id}
                        leftIcon={<Hand size={14} aria-hidden="true" />}
                        onClick={() => void takeIssue(issue)}
                      >
                        Nhận xử lý
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setResolving(issue)}>
                      Đóng sự cố
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-4 flex flex-col gap-4">
        <Panel title={`Đơn bị huỷ (${data?.cancelled.length ?? 0})`} bodyClassName="p-0">
          {data ? (
            <OrderTable orders={data.cancelled} kind="cancelled" />
          ) : (
            <Skeleton className="m-5 h-40" />
          )}
        </Panel>
        <Panel title={`Đơn hoàn trả (${data?.returned.length ?? 0})`} bodyClassName="p-0">
          {data ? (
            <OrderTable orders={data.returned} kind="returned" />
          ) : (
            <Skeleton className="m-5 h-40" />
          )}
        </Panel>
      </div>

      <Modal
        isOpen={resolving !== null}
        onClose={() => setResolving(null)}
        title="Đóng sự cố"
        description={
          resolving
            ? `${ISSUE_TYPE_LABELS[resolving.type]} · đơn #${resolving.orderCode}`
            : undefined
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResolving(null)}>
              Huỷ
            </Button>
            <Button isLoading={busyId === resolving?.id} onClick={() => void resolveIssue()}>
              Đóng sự cố
            </Button>
          </div>
        }
      >
        <Textarea
          label="Đã xử lý thế nào?"
          name="issue-resolution"
          required
          rows={3}
          className="min-h-24 text-sm"
          value={resolution}
          error={resolutionError}
          maxLength={400}
          placeholder="VD: Gửi bù hàng, hoàn 50.000₫ phí ship cho khách."
          onChange={(event) => setResolution(event.target.value)}
        />
      </Modal>
    </>
  );
}

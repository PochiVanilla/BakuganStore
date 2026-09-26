import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, ExternalLink, Gavel, PlusCircle, Timer, UserRound } from 'lucide-react';
import type { AdminAuctionRow, AuctionFulfillmentStatus } from '@/types';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import { listAdminAuctions, markAuctionForfeited } from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, ButtonLink, EmptyState, Modal, Seo, Skeleton, Textarea } from '@/components/ui';
import { AdminPageHeader, ErrorBox, FilterTabs, StatCard } from '@/features/admin/adminUi';

const FULFILLMENT_LABELS: Record<AuctionFulfillmentStatus, string> = {
  running: 'Đang diễn ra / sắp mở',
  'awaiting-order': 'Chờ tạo đơn',
  'order-created': 'Đã tạo đơn',
  'no-winner': 'Không có người đặt',
  forfeited: 'Bỏ cọc / không thanh toán',
};

const FULFILLMENT_STYLES: Record<AuctionFulfillmentStatus, string> = {
  running: 'border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan',
  'awaiting-order': 'border-accent-pink/50 bg-accent-pink/12 text-accent-pink',
  'order-created': 'border-success/45 bg-success/10 text-success',
  'no-winner': 'border-white/15 bg-white/5 text-text-muted',
  forfeited: 'border-danger/40 bg-danger/10 text-danger',
};

type Filter = AuctionFulfillmentStatus | 'all';

function AuctionRow({ row, onForfeit }: { row: AdminAuctionRow; onForfeit: () => void }) {
  const { auction, winner, fulfillment } = row;
  const isSealed = auction.priceVisibility === 'sealed';
  const ended = auction.status === 'ended';

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
      <img src={auction.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-[11px] font-semibold',
              FULFILLMENT_STYLES[fulfillment],
            )}
          >
            {FULFILLMENT_LABELS[fulfillment]}
          </span>
          {isSealed && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-soft">
              <EyeOff size={11} aria-hidden="true" /> Phiên kín
            </span>
          )}
          {auction.extensionCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
              <Timer size={11} aria-hidden="true" /> Gia hạn {auction.extensionCount} lần
            </span>
          )}
        </div>
        <p className="mt-1.5 font-semibold text-text">{auction.title}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {auction.status === 'upcoming'
            ? `Mở ${formatRelativeTime(auction.startAt)} · ${formatDateTime(auction.startAt)}`
            : `Kết thúc ${formatRelativeTime(auction.endAt)} · ${formatDateTime(auction.endAt)}`}
          {' · '}
          {auction.bidCount} lượt đặt
        </p>

        {winner && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/8 bg-surface-2/50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-text">
              <UserRound size={14} className="text-accent-cyan" aria-hidden="true" />
              {winner.fullName}
            </span>
            {winner.phone && (
              <a href={`tel:${winner.phone}`} className="text-accent-cyan hover:underline">
                {winner.phone}
              </a>
            )}
            {winner.email && <span className="text-text-muted">{winner.email}</span>}
          </div>
        )}
        {row.note && <p className="mt-2 text-xs text-text-muted">Ghi chú: {row.note}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="sm:text-right">
          <p className="text-xs text-text-muted">{ended ? 'Giá chốt' : 'Giá hiện tại'}</p>
          <p className="text-lg font-semibold text-text tabular-nums">
            {formatCurrency(auction.currentPrice)}
          </p>
          {isSealed && !ended && (
            <p className="text-[11px] text-text-muted">Khách không thấy giá này</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {fulfillment === 'awaiting-order' && (
            <>
              <ButtonLink
                to={`${ADMIN_ROUTES.createOrder}?auction=${auction.id}`}
                size="sm"
                leftIcon={<PlusCircle size={15} aria-hidden="true" />}
              >
                Tạo đơn
              </ButtonLink>
              <Button size="sm" variant="ghost" onClick={onForfeit}>
                Bỏ cọc
              </Button>
            </>
          )}
          {row.orderId && (
            <ButtonLink to={ADMIN_ROUTES.orderDetail(row.orderId)} size="sm" variant="secondary">
              Đơn #{row.orderCode}
            </ButtonLink>
          )}
          <Link
            to={ROUTES.auctionDetail(auction.id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-text-muted hover:bg-white/5 hover:text-text"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Xem phiên
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function AuctionsAdminPage() {
  const revision = useLiveRevision();
  const [filter, setFilter] = useState<Filter>('all');
  const [forfeitTarget, setForfeitTarget] = useState<AdminAuctionRow | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { data, isLoading, error, reload } = useAsync(() => listAdminAuctions(), [revision], {
    keepPreviousData: true,
  });

  const rows = data ?? [];
  const count = (status: AuctionFulfillmentStatus): number =>
    rows.filter((row) => row.fulfillment === status).length;
  const visible = filter === 'all' ? rows : rows.filter((row) => row.fulfillment === filter);
  const soldValue = rows
    .filter((row) => row.fulfillment === 'order-created')
    .reduce((sum, row) => sum + row.auction.currentPrice, 0);

  const confirmForfeit = async (): Promise<void> => {
    if (!forfeitTarget) return;
    setIsSaving(true);
    try {
      await markAuctionForfeited(forfeitTarget.auction.id, note);
      toast.info('Đã đóng phiên', 'Người thắng không hoàn tất thanh toán.');
      setForfeitTarget(null);
      setNote('');
    } catch (forfeitError) {
      toast.error('Không cập nhật được', getApiErrorMessage(forfeitError));
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: Filter[] = [
    'all',
    'awaiting-order',
    'running',
    'order-created',
    'forfeited',
    'no-winner',
  ];

  return (
    <>
      <Seo
        title="Đơn đấu giá"
        description="Quản lý phiên và đơn đấu giá"
        path={ADMIN_ROUTES.auctions}
        noIndex
      />
      <AdminPageHeader
        title="Đơn đấu giá"
        description="Theo dõi các phiên, liên hệ người thắng và tạo đơn. Admin xem được cả giá của phiên kín."
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Đang diễn ra / sắp mở"
          value={count('running')}
          icon={<Gavel size={16} />}
        />
        <StatCard
          label="Chờ tạo đơn"
          value={count('awaiting-order')}
          tone={count('awaiting-order') > 0 ? 'warning' : 'default'}
          hint="Liên hệ người thắng trong 24 giờ"
        />
        <StatCard
          label="Đã bán qua đấu giá"
          value={formatCurrency(soldValue)}
          hint={`${count('order-created')} phiên đã tạo đơn`}
        />
        <StatCard
          label="Bỏ cọc"
          value={count('forfeited')}
          tone={count('forfeited') > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="mb-4">
        <FilterTabs
          label="Lọc phiên"
          value={filter}
          onChange={setFilter}
          tabs={tabs.map((value) => ({
            value,
            label: value === 'all' ? 'Tất cả' : FULFILLMENT_LABELS[value],
            count: value === 'all' ? rows.length : count(value),
          }))}
        />
      </div>

      <div
        className={cn(
          'rounded-2xl border border-white/8 bg-surface/80',
          isLoading && data && 'opacity-60',
        )}
      >
        {!data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Gavel size={26} aria-hidden="true" />}
              title="Không có phiên nào ở mục này"
            />
          </div>
        ) : (
          <ul className="divide-y divide-white/6">
            {visible.map((row) => (
              <AuctionRow key={row.auction.id} row={row} onForfeit={() => setForfeitTarget(row)} />
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={forfeitTarget !== null}
        onClose={() => setForfeitTarget(null)}
        title="Đánh dấu người thắng bỏ cọc"
        description={forfeitTarget?.auction.title}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForfeitTarget(null)}>
              Đóng
            </Button>
            <Button variant="danger" isLoading={isSaving} onClick={() => void confirmForfeit()}>
              Xác nhận
            </Button>
          </div>
        }
      >
        <p className="mb-3">
          Phiên sẽ đóng mà không tạo đơn. Theo luật đấu giá, người thắng quá 48 giờ không thanh toán
          có thể bị hạn chế tham gia các phiên sau.
        </p>
        <Textarea
          label="Ghi chú"
          name="forfeit-note"
          rows={2}
          className="min-h-20 text-sm"
          value={note}
          maxLength={200}
          placeholder="VD: Gọi 3 lần không nghe máy, quá 48 giờ."
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </>
  );
}

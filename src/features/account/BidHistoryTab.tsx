import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { AUCTION_STATUS_LABELS } from '@/constants/catalog';
import { fetchMyBids } from '@/services/api/auctionService';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ButtonLink, EmptyState, Skeleton } from '@/components/ui';

export function BidHistoryTab() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading } = useAsync(() => fetchMyBids(user?.id ?? ''), [user?.id], {
    enabled: Boolean(user?.id),
  });

  const records = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-text">Lịch sử đấu giá</h2>
      <p className="mt-1.5 text-sm text-text-muted">
        Các phiên bạn đã tham gia và trạng thái lượt đặt giá của bạn.
      </p>

      {records.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Gavel size={26} aria-hidden="true" />}
            title="Bạn chưa tham gia phiên nào"
            description="Vào sàn đấu giá và đặt lượt đầu tiên để cạnh tranh những món hàng hiếm nhất."
            action={<ButtonLink to={ROUTES.auctions}>Vào sàn đấu giá</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {records.map(({ auction, myHighestBid, isWinning }) => (
            <li key={auction.id} className="rounded-2xl border border-white/8 bg-surface/70 p-4">
              <div className="flex gap-4">
                <Link to={ROUTES.auctionDetail(auction.id)} className="shrink-0">
                  <img
                    src={auction.images[0]}
                    alt=""
                    loading="lazy"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl bg-surface-2 object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={ROUTES.auctionDetail(auction.id)}
                    className="line-clamp-2 text-sm font-semibold text-text transition hover:text-accent-cyan"
                  >
                    {auction.title}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider',
                        auction.status === 'live'
                          ? 'border-danger/45 bg-danger/12 text-danger'
                          : auction.status === 'upcoming'
                            ? 'border-accent-cyan/45 bg-accent-cyan/12 text-accent-cyan'
                            : 'border-white/15 bg-white/5 text-text-muted',
                      )}
                    >
                      {AUCTION_STATUS_LABELS[auction.status].toUpperCase()}
                    </span>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider',
                        isWinning
                          ? 'border-success/45 bg-success/12 text-success'
                          : 'border-warning/45 bg-warning/12 text-warning',
                      )}
                    >
                      {isWinning
                        ? auction.status === 'ended'
                          ? 'ĐÃ THẮNG'
                          : 'ĐANG DẪN ĐẦU'
                        : 'ĐÃ BỊ VƯỢT GIÁ'}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-text-muted">Giá của bạn</dt>
                      <dd className="font-display font-bold text-text">
                        {formatCurrency(myHighestBid)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">
                        {auction.status === 'ended' ? 'Giá chốt' : 'Giá hiện tại'}
                      </dt>
                      <dd className="font-display font-bold text-gold">
                        {formatCurrency(auction.currentPrice)}
                      </dd>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-text-muted">
                        {auction.status === 'ended' ? 'Đã kết thúc' : 'Kết thúc lúc'}
                      </dt>
                      <dd className="text-text">{formatDateTime(auction.endAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

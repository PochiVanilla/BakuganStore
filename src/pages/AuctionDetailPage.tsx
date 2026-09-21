import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Check, Eye, Gavel, Radio, ShieldCheck, Users, Zap } from 'lucide-react';
import type { Auction } from '@/types';
import { ROUTES } from '@/constants/routes';
import { AUCTION_STATUS_LABELS, CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import { fetchAuctionById } from '@/services/api/auctionService';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDateTime, formatNumber, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  AttributeBadge,
  Button,
  Container,
  Countdown,
  EmptyState,
  Seo,
  Skeleton,
} from '@/components/ui';
import { ProductGallery } from '@/features/products/ProductGallery';
import { BidForm } from '@/features/auction/BidForm';
import { useAuctionSocket, type AuctionSocketEvent } from '@/features/auction/useAuctionSocket';

function DetailSkeleton() {
  return (
    <Container className="py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </div>
    </Container>
  );
}

export default function AuctionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, error } = useAsync(() => fetchAuctionById(id), [id]);

  /**
   * `data` là bản từ server; `liveAuction` là bản đã cộng thêm các lượt đặt giá
   * realtime trong phiên làm việc. Khi server trả bản mới thì reset ngay lúc
   * render thay vì đồng bộ qua useEffect.
   */
  const [liveAuction, setLiveAuction] = useState<Auction | null>(null);
  const [syncedFrom, setSyncedFrom] = useState<Auction | null>(null);
  const [isOutbid, setIsOutbid] = useState(false);

  if (data && syncedFrom !== data) {
    setSyncedFrom(data);
    setLiveAuction(data);
  }

  const auction = liveAuction;

  /** Người khác đặt giá qua kênh realtime → cập nhật giá và cảnh báo nếu ta bị vượt. */
  const handleSocketEvent = useCallback(
    (event: AuctionSocketEvent) => {
      if (event.type !== 'bid-placed') return;

      setLiveAuction((current) => {
        if (!current || event.amount <= current.currentPrice) return current;

        const wasLeading = current.bids[0]?.bidderId === user?.id;
        if (wasLeading && event.bidderId !== user?.id) {
          setIsOutbid(true);
          toast.error(
            'Bạn đã bị vượt giá!',
            `${event.bidderMaskedName} vừa đặt ${formatCurrency(event.amount)}.`,
          );
        }

        return {
          ...current,
          currentPrice: event.amount,
          bidCount: current.bidCount + 1,
          bids: [
            {
              id: `bid-live-${event.at}`,
              auctionId: current.id,
              bidderId: event.bidderId,
              bidderMaskedName: event.bidderMaskedName,
              amount: event.amount,
              createdAt: event.at,
            },
            ...current.bids,
          ],
        };
      });
    },
    [user?.id],
  );

  const { status: socketStatus } = useAuctionSocket({
    auctionId: id,
    enabled: auction?.status === 'live',
    currentPrice: auction?.currentPrice ?? 0,
    bidStep: auction?.bidStep ?? 50_000,
    onEvent: handleSocketEvent,
  });

  if (isLoading || (!auction && !error)) return <DetailSkeleton />;

  if (error || !auction) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Không tìm thấy phiên đấu giá"
          description={error ?? 'Phiên này có thể đã bị gỡ khỏi sàn.'}
          action={<Button onClick={() => navigate(ROUTES.auctions)}>Về sàn đấu giá</Button>}
        />
      </Container>
    );
  }

  const seriesMeta = SERIES_META[auction.series];
  const isLive = auction.status === 'live';
  const myHighestBid = user
    ? Math.max(
        0,
        ...auction.bids.filter((bid) => bid.bidderId === user.id).map((bid) => bid.amount),
      )
    : 0;
  const isLeading = user ? auction.bids[0]?.bidderId === user.id : false;

  return (
    <>
      <Seo
        title={auction.title}
        description={`${AUCTION_STATUS_LABELS[auction.status]} — giá hiện tại ${formatCurrency(auction.currentPrice)}. ${auction.description.slice(0, 120)}`}
        image={auction.images[0]}
        path={ROUTES.auctionDetail(auction.id)}
      />

      <Container className="py-6 sm:py-10">
        <nav
          aria-label="Đường dẫn"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-text-muted"
        >
          <Link to={ROUTES.home} className="transition hover:text-accent-cyan">
            Trang chủ
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to={ROUTES.auctions} className="transition hover:text-accent-cyan">
            Đấu giá
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="truncate text-text">{auction.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <ProductGallery images={auction.images} alt={auction.title} />

            <section className="mt-8 rounded-2xl border border-white/8 bg-surface/60 p-6">
              <h2 className="mb-3 font-display text-base font-bold text-text">Mô tả sản phẩm</h2>
              {auction.description.split('\n\n').map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="mb-3 text-sm leading-relaxed text-text-muted last:mb-0"
                >
                  {paragraph}
                </p>
              ))}

              <h3 className="mt-6 mb-2.5 font-display text-sm font-bold text-text">
                Bao gồm trong lô
              </h3>
              <ul className="flex flex-wrap gap-2">
                {auction.accessories.map((accessory) => (
                  <li
                    key={accessory.name}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-success/35 bg-success/8 px-2.5 py-1.5 text-xs text-success"
                  >
                    <Check size={12} aria-hidden="true" />
                    {accessory.name}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-display text-[11px] font-bold tracking-wider',
                  isLive
                    ? 'border-danger/50 bg-danger/15 text-danger'
                    : auction.status === 'upcoming'
                      ? 'border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan'
                      : 'border-white/15 bg-white/5 text-text-muted',
                )}
              >
                {isLive && (
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger"
                    aria-hidden="true"
                  />
                )}
                {AUCTION_STATUS_LABELS[auction.status].toUpperCase()}
              </span>
              <AttributeBadge attribute={auction.attribute} />
              {isLive && socketStatus !== 'closed' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/35 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                  <Radio size={11} aria-hidden="true" />
                  Cập nhật realtime
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl leading-tight font-extrabold text-text sm:text-3xl">
              {auction.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1.5 text-gold">
                <Zap size={14} aria-hidden="true" />
                {formatNumber(auction.gPower)} G
              </span>
              <span>{seriesMeta.label}</span>
              <span>{CONDITION_LABELS[auction.condition]}</span>
              <span className="inline-flex items-center gap-1.5">
                <Eye size={14} aria-hidden="true" />
                {formatNumber(auction.watcherCount)} người theo dõi
              </span>
            </div>

            {/* Bảng giá + đồng hồ */}
            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/5 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs tracking-wider text-text-muted uppercase">
                    {auction.status === 'ended' ? 'Giá chốt' : 'Giá hiện tại'}
                  </p>
                  <p className="mt-1 font-display text-3xl font-black text-gold neon-text-gold">
                    {formatCurrency(auction.currentPrice)}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Giá khởi điểm {formatCurrency(auction.startPrice)} · Bước giá{' '}
                    {formatCurrency(auction.bidStep)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                    <Gavel size={12} aria-hidden="true" />
                    {auction.bidCount} lượt đặt
                  </p>
                  {auction.buyNowPrice && auction.status !== 'ended' && (
                    <p className="mt-1 text-xs text-text-muted">
                      Mua ngay:{' '}
                      <span className="font-semibold text-text">
                        {formatCurrency(auction.buyNowPrice)}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 border-t border-gold/15 pt-4">
                <p className="mb-2.5 text-xs tracking-wider text-text-muted uppercase">
                  {auction.status === 'upcoming'
                    ? `Mở phiên lúc ${formatDateTime(auction.startAt)}`
                    : auction.status === 'live'
                      ? `Kết thúc lúc ${formatDateTime(auction.endAt)}`
                      : `Đã kết thúc ${formatRelativeTime(auction.endAt)}`}
                </p>
                {auction.status !== 'ended' && (
                  <Countdown
                    targetIso={auction.status === 'upcoming' ? auction.startAt : auction.endAt}
                    size="md"
                  />
                )}
              </div>
            </div>

            {/* Trạng thái của tôi */}
            {myHighestBid > 0 && (
              <div
                className={cn(
                  'mt-4 flex items-start gap-2.5 rounded-xl border p-4 text-sm',
                  isLeading
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-warning/40 bg-warning/10 text-warning',
                )}
              >
                <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {isLeading
                    ? `Bạn đang dẫn đầu với ${formatCurrency(myHighestBid)}.`
                    : `Lượt đặt cao nhất của bạn là ${formatCurrency(myHighestBid)} — hiện đã bị vượt.`}
                </span>
              </div>
            )}

            <div className="mt-5">
              <BidForm
                auction={auction}
                isOutbid={isOutbid && !isLeading}
                onBidPlaced={(updated) => {
                  setLiveAuction(updated);
                  setIsOutbid(false);
                }}
              />
            </div>

            {/* Lịch sử đặt giá */}
            <section className="mt-6 rounded-2xl border border-white/8 bg-surface/60 p-5">
              <h2 className="mb-4 inline-flex items-center gap-2 font-display text-base font-bold text-text">
                <Users size={17} className="text-accent-cyan" aria-hidden="true" />
                Lịch sử đặt giá ({auction.bids.length})
              </h2>

              {auction.bids.length === 0 ? (
                <p className="py-5 text-center text-sm text-text-muted">
                  Chưa có lượt đặt giá nào. Hãy là người đầu tiên!
                </p>
              ) : (
                <ol className="max-h-80 divide-y divide-white/6 overflow-y-auto">
                  {auction.bids.map((bid, index) => {
                    const isMine = user ? bid.bidderId === user.id : false;
                    return (
                      <li
                        key={bid.id}
                        className={cn(
                          'flex items-center justify-between gap-3 py-2.5',
                          index === 0 && 'font-semibold',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {index === 0 && (
                            <span
                              className="rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold text-background"
                              aria-label="Đang dẫn đầu"
                            >
                              CAO NHẤT
                            </span>
                          )}
                          <span
                            className={cn(
                              'truncate text-sm',
                              isMine ? 'text-accent-cyan' : 'text-text-muted',
                            )}
                          >
                            {isMine ? 'Bạn' : bid.bidderMaskedName}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-[11px] text-text-muted">
                            {formatRelativeTime(bid.createdAt)}
                          </span>
                          <span
                            className={cn(
                              'font-display text-sm tabular-nums',
                              index === 0 ? 'text-gold' : 'text-text',
                            )}
                          >
                            {formatCurrency(bid.amount)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <p className="mt-4 border-t border-white/6 pt-3 text-[11px] leading-relaxed text-text-muted">
                Tên người đặt giá được ẩn một phần để bảo vệ quyền riêng tư. Toàn bộ lượt đặt đều
                được ghi nhận và không thể chỉnh sửa.
              </p>
            </section>
          </div>
        </div>
      </Container>
    </>
  );
}

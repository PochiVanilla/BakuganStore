import { useState } from 'react';
import { Gavel, Info } from 'lucide-react';
import type { AuctionStatus } from '@/types';
import { ROUTES } from '@/constants/routes';
import { AUCTION_STATUS_LABELS } from '@/constants/catalog';
import { fetchAuctions } from '@/services/api/auctionService';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/utils/cn';
import { AuctionCardSkeleton, ButtonLink, Container, EmptyState, Seo } from '@/components/ui';
import { AuctionCard } from '@/features/auction/AuctionCard';

type TabKey = AuctionStatus | 'all';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'live', label: AUCTION_STATUS_LABELS.live },
  { key: 'upcoming', label: AUCTION_STATUS_LABELS.upcoming },
  { key: 'ended', label: AUCTION_STATUS_LABELS.ended },
  { key: 'all', label: 'Tất cả' },
];

const RULES = [
  'Chỉ tài khoản đã đăng nhập mới được đặt giá.',
  'Mỗi lượt đặt phải cao hơn giá hiện tại ít nhất một bước giá.',
  'Lượt đặt giá là cam kết mua, không thể huỷ sau khi xác nhận.',
  'Người thắng cần hoàn tất thanh toán trong 48 giờ.',
];

export default function AuctionsPage() {
  const [tab, setTab] = useState<TabKey>('live');
  const { data, isLoading, error } = useAsync(() => fetchAuctions(), []);

  const auctions = data ?? [];
  const counts: Record<TabKey, number> = {
    live: auctions.filter((item) => item.status === 'live').length,
    upcoming: auctions.filter((item) => item.status === 'upcoming').length,
    ended: auctions.filter((item) => item.status === 'ended').length,
    all: auctions.length,
  };

  const visible = tab === 'all' ? auctions : auctions.filter((item) => item.status === tab);

  return (
    <>
      <Seo
        title="Sàn đấu giá Bakugan"
        description="Tham gia các phiên đấu giá Bakugan hàng hiếm tại TD Bakugan. Đặt giá minh bạch, theo dõi realtime, lịch sử đặt giá công khai."
        path={ROUTES.auctions}
      />

      <Container className="py-8 sm:py-12">
        <header className="relative mb-9 overflow-hidden rounded-3xl border border-accent-pink/25 bg-surface/70 p-8 sm:p-10">
          <div
            className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-accent-pink/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-0 -bottom-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-pink/40 bg-accent-pink/10 px-3.5 py-1.5 text-xs font-bold text-accent-pink shadow-glow-pink">
              <Gavel size={13} aria-hidden="true" />
              SÀN ĐẤU GIÁ
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
              <span className="text-gradient-neon">Đấu giá hàng hiếm</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
              Những món không bán lẻ chỉ xuất hiện tại đây. Giá do chính cộng đồng quyết định — ai
              trân trọng món đồ nhất sẽ mang nó về.
            </p>
          </div>
        </header>

        {/* Tab trạng thái */}
        <div
          className="mb-6 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Lọc theo trạng thái phiên"
        >
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'rounded-xl border px-4 py-2.5 font-display text-sm font-bold transition',
                tab === item.key
                  ? 'border-transparent gradient-cta text-white shadow-glow-pink'
                  : 'border-white/10 bg-surface-2 text-text-muted hover:border-accent-cyan/50 hover:text-accent-cyan',
              )}
            >
              {item.label}
              <span className="ml-1.5 opacity-70">({counts[item.key]})</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <AuctionCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Không tải được danh sách phiên" description={error} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Gavel size={26} aria-hidden="true" />}
            title={`Chưa có phiên nào ${TABS.find((item) => item.key === tab)?.label.toLowerCase()}`}
            description="Theo dõi trang này hoặc đăng ký nhận tin để biết ngay khi shop mở phiên mới."
            action={<ButtonLink to={ROUTES.products}>Xem sản phẩm bán lẻ</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}

        {/* Thể lệ */}
        <section className="mt-12 rounded-2xl border border-white/8 bg-surface/60 p-6">
          <h2 className="mb-3.5 inline-flex items-center gap-2 font-display text-base font-bold text-text">
            <Info size={17} className="text-accent-cyan" aria-hidden="true" />
            Thể lệ đấu giá
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-2.5 text-sm text-text-muted">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                  aria-hidden="true"
                />
                {rule}
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </>
  );
}

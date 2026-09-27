import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Clock,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { FEED_STATUS_LABELS } from '@/constants/catalog';
import { fetchFeedByNumber } from '@/services/api/feedService';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useCartStore, selectCartCount } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  Button,
  ButtonLink,
  Container,
  Countdown,
  EmptyState,
  ItemGridSkeleton,
  Seo,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { FeedGallery } from '@/features/feed/FeedGallery';
import { FeedProgress } from '@/features/feed/FeedProgress';
import { ItemCard } from '@/features/feed/ItemCard';
import { FEED_BADGE } from '@/features/feed/feedUi';

const HOW_TO_BUY = [
  { icon: ShoppingCart, text: 'Bấm "Thêm vào giỏ" những con bạn muốn (mỗi mã chỉ có 1 con).' },
  { icon: ShoppingBag, text: 'Vào giỏ hàng, điền địa chỉ và chọn cách thanh toán rồi đặt hàng.' },
  {
    icon: PackageCheck,
    text: 'Con bạn đặt hiện SOLD ngay. Shop gọi xác nhận, đóng gói chống sốc và gửi đi.',
  },
] as const;

export default function FeedDetailPage() {
  const { number = '' } = useParams<{ number: string }>();
  const { hash } = useLocation();
  const revision = useLiveRevision();
  const feedNumber = Number(number);
  const cartCount = useCartStore(selectCartCount);
  const openChat = useUIStore((state) => state.openChat);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const {
    data: feed,
    isLoading,
    error,
  } = useAsync(() => fetchFeedByNumber(feedNumber), [feedNumber, revision], {
    keepPreviousData: true,
  });
  const targetCode = decodeURIComponent(hash.replace('#', ''));

  // Mở từ link "#BK-0231" (VD trợ lý AI gợi ý) -> cuộn tới đúng con đó.
  const ready = Boolean(feed);
  useEffect(() => {
    if (!ready || !targetCode) return;
    document.getElementById(targetCode)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [ready, targetCode]);

  if (isLoading && !feed) {
    return (
      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
        <div className="mt-10">
          <ItemGridSkeleton count={8} />
        </div>
      </Container>
    );
  }

  if (error || !feed) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Không tìm thấy feed"
          description={error ?? 'Feed này có thể đã bán hết và được gỡ khỏi web.'}
          action={<ButtonLink to={ROUTES.feeds}>Xem các feed khác</ButtonLink>}
        />
      </Container>
    );
  }

  const isUpcoming = feed.status === 'upcoming';
  const items = onlyAvailable
    ? feed.items.filter((item) => item.status === 'available')
    : feed.items;

  return (
    <>
      <Seo
        title={`Feed #${feed.number}: ${feed.title}`}
        description={`${FEED_STATUS_LABELS[feed.status]} — ${feed.itemCount} con Bakugan, còn ${feed.itemCount - feed.soldCount} con. ${feed.caption.slice(0, 110)}`}
        image={feed.images[0]?.startsWith('/') ? feed.images[0] : undefined}
        path={ROUTES.feedDetail(feed.number)}
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
          <Link to={ROUTES.feeds} className="transition hover:text-accent-cyan">
            Feed bán
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="text-text">Feed #{feed.number}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          <FeedGallery images={feed.images} alt={`Ảnh chụp lô hàng feed #${feed.number}`} />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge type={FEED_BADGE[feed.status]} />
              <span className="font-display text-xs font-bold tracking-wider text-text-muted">
                FEED #{feed.number}
              </span>
            </div>
            <h1 className="mt-3 font-display text-2xl leading-tight font-black text-text sm:text-3xl">
              {feed.title}
            </h1>
            <p className="mt-2 text-xs text-text-muted">
              Đăng {formatRelativeTime(feed.publishedAt)} · {formatDateTime(feed.publishedAt)}
            </p>

            {isUpcoming && (
              <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/8 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-gold">
                  <Clock size={16} aria-hidden="true" />
                  Mở bán lúc {formatDateTime(feed.opensAt)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Bạn xem trước danh sách bên dưới, tới giờ là thêm vào giỏ và chốt được ngay.
                </p>
                <Countdown
                  targetIso={feed.opensAt}
                  size="md"
                  finishedLabel="Đã mở bán — tải lại trang để chốt đơn"
                  className="mt-3"
                />
              </div>
            )}

            <p className="mt-5 text-sm leading-relaxed whitespace-pre-line text-text-muted">
              {feed.caption}
            </p>

            <div className="mt-5 rounded-2xl border border-white/8 bg-surface/70 p-4">
              <FeedProgress sold={feed.soldCount} total={feed.itemCount} />
              {feed.priceRange && (
                <p className="mt-3 text-sm text-text-muted">
                  Giá các con còn bán:{' '}
                  <span className="font-display font-bold text-gold">
                    {formatCurrency(feed.priceRange.min)}
                    {feed.priceRange.max !== feed.priceRange.min &&
                      ` – ${formatCurrency(feed.priceRange.max)}`}
                  </span>
                </p>
              )}
            </div>

            <ol className="mt-5 space-y-2.5">
              {HOW_TO_BUY.map((step, index) => (
                <li key={step.text} className="flex items-start gap-3 text-sm text-text-muted">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent-cyan/35 bg-accent-cyan/10 text-accent-cyan">
                    <step.icon size={15} aria-hidden="true" />
                    <span className="sr-only">Bước {index + 1}</span>
                  </span>
                  <span className="pt-1">{step.text}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {cartCount > 0 && (
                <ButtonLink to={ROUTES.cart} leftIcon={<ShoppingBag size={17} />}>
                  Xem giỏ hàng ({cartCount})
                </ButtonLink>
              )}
              <Button
                variant="outline"
                leftIcon={<MessageCircle size={17} />}
                onClick={() => openChat({ prefill: `Mình hỏi về feed #${feed.number}: ` })}
              >
                Hỏi shop về feed này
              </Button>
            </div>
          </div>
        </div>

        <section className="mt-12" aria-labelledby="feed-items">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="feed-items" className="font-display text-xl font-bold text-text">
                {feed.itemCount} con Bakugan trong feed
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Mỗi con một mã riêng — nhắn shop kèm mã (VD {feed.items[0]?.code ?? 'BK-0001'}) nếu
                cần hỏi thêm.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent-cyan)]"
              />
              Chỉ hiện con còn bán
            </label>
          </div>

          {items.length > 0 ? (
            <div
              className={cn(
                'mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4',
                isLoading && 'opacity-70',
              )}
            >
              {items.map((item) => (
                <ItemCard key={item.id} item={item} highlighted={item.code === targetCode} />
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-white/12 px-5 py-10 text-center text-sm text-text-muted">
              Feed này đã bán hết. Xem{' '}
              <Link to={ROUTES.feeds} className="font-semibold text-accent-cyan hover:underline">
                các feed khác
              </Link>{' '}
              nhé!
            </p>
          )}
        </section>
      </Container>
    </>
  );
}

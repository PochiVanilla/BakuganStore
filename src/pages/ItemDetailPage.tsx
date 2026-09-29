import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock,
  Heart,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD, ROUTES } from '@/constants/routes';
import { SERIES_META } from '@/constants/catalog';
import { fetchItemDetail } from '@/services/api/feedService';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast, useUIStore } from '@/store/uiStore';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  AttributeBadge,
  Button,
  ButtonLink,
  Container,
  Countdown,
  EmptyState,
  Seo,
  Skeleton,
  SnapSlider,
  StatusBadge,
} from '@/components/ui';
// Chỉ hai trang chi tiết dùng bộ ảnh phóng to — import thẳng để khỏi dồn vào gói tải đầu.
import { MediaGallery } from '@/components/ui/MediaGallery';
import { ItemCard } from '@/features/feed/ItemCard';

const GUARANTEES = [
  { icon: BadgeCheck, text: 'Hàng chính hãng, đã test cơ cấu bung nở và lực nam châm' },
  { icon: PackageCheck, text: 'Đóng gói chống sốc hai lớp, hộp cứng' },
  {
    icon: Truck,
    text: `Giao toàn quốc, miễn phí ship cho đơn từ ${formatCurrency(FREE_SHIPPING_THRESHOLD)}`,
  },
  { icon: RefreshCw, text: 'Đổi trả trong 7 ngày nếu lỗi cơ cấu hoặc giao sai mã' },
];

/** Tối đa ngần này con khác trong cùng feed ở băng gợi ý */
const RELATED_LIMIT = 12;

/** Hai nút mua nằm chung một hàng với nút tim — điện thoại thu gọn chữ để không xuống dòng */
const buyButtonClass = 'min-w-0 flex-1 px-3 text-sm whitespace-nowrap sm:px-7 sm:text-base';

function DetailSkeleton() {
  return (
    <Container className="py-6 sm:py-10">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </Container>
  );
}

export default function ItemDetailPage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const revision = useLiveRevision();
  const openChat = useUIStore((state) => state.openChat);
  const { data, isLoading, error } = useAsync(() => fetchItemDetail(code), [code, revision], {
    keepPreviousData: true,
  });
  const item = data?.item;
  const feed = data?.feed;

  const inCart = useCartStore((state) =>
    item ? state.items.some((entry) => entry.itemId === item.id) : false,
  );
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const isWishlisted = useWishlistStore((state) =>
    item ? state.itemIds.includes(item.id) : false,
  );
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  // Gõ tay "/bakugan/bk231" -> đổi về đúng đường dẫn "/bakugan/BK-0231".
  const canonicalCode = item?.code;
  useEffect(() => {
    if (canonicalCode && canonicalCode !== code) {
      navigate(ROUTES.itemDetail(canonicalCode), { replace: true });
    }
  }, [canonicalCode, code, navigate]);

  if (isLoading && !data) return <DetailSkeleton />;

  if (error || !item || !feed) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Không tìm thấy Bakugan này"
          description={error ?? 'Con này có thể đã được shop gỡ khỏi web.'}
          action={<ButtonLink to={ROUTES.feeds}>Xem các feed đang bán</ButtonLink>}
        />
      </Container>
    );
  }

  const isSold = item.status === 'sold';
  const isUpcoming = !isSold && !item.onSale;
  const series = item.series ? SERIES_META[item.series] : undefined;
  const others = feed.items
    .filter((entry) => entry.id !== item.id)
    // Con còn bán lên trước
    .sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold'))
    .slice(0, RELATED_LIMIT);
  const shareImage = item.image.startsWith('/') || /^https?:/.test(item.image) ? item.image : '';

  const handleAdd = (): void => {
    if (inCart) {
      openDrawer();
      return;
    }
    addItem(item);
    toast.success(`Đã thêm ${item.code} vào giỏ`, item.name);
  };

  const handleBuyNow = (): void => {
    if (!inCart) addItem(item);
    navigate(ROUTES.cart);
  };

  const handleWishlist = (): void => {
    toggleWishlist(item.id);
    toast.info(isWishlisted ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', item.code);
  };

  return (
    <>
      <Seo
        title={`${item.name} ${item.code}`}
        description={[
          item.condition,
          item.attribute && `Hệ ${item.attribute}`,
          isSold ? 'đã bán' : `giá ${formatCurrency(item.price)}`,
          `nằm trong feed #${feed.number} của TD Bakugan.`,
        ]
          .filter(Boolean)
          .join('. ')}
        image={shareImage || undefined}
        path={ROUTES.itemDetail(item.code)}
        type="product"
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
          <Link
            to={ROUTES.feedDetail(feed.number, item.code)}
            className="transition hover:text-accent-cyan"
          >
            Feed #{feed.number}
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="font-mono text-text">{item.code}</span>
        </nav>

        <div
          className={cn(
            'grid gap-8 lg:grid-cols-2 lg:gap-12',
            isLoading && 'opacity-70 transition-opacity',
          )}
        >
          <MediaGallery
            key={item.id}
            photos={item.images}
            video={item.video}
            alt={`${item.name} ${item.code}`}
          />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-accent-cyan">
                {item.code}
              </span>
              <AttributeBadge attribute={item.attribute} />
              <StatusBadge type={isSold ? 'SOLD' : isUpcoming ? 'UPCOMING' : 'SELLING'} />
            </div>

            <h1 className="mt-3 font-display text-2xl leading-tight font-extrabold text-text sm:text-3xl">
              {item.name}
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Trong{' '}
              <Link
                to={ROUTES.feedDetail(feed.number, item.code)}
                className="font-semibold text-accent-cyan hover:underline"
              >
                feed #{feed.number}
              </Link>{' '}
              — {feed.title}
            </p>

            {/* Giá */}
            <div
              className={cn(
                'mt-5 rounded-2xl border p-5',
                isSold ? 'border-danger/30 bg-danger/5' : 'border-gold/20 bg-gold/5',
              )}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span
                  className={cn(
                    'font-display text-3xl font-black',
                    isSold ? 'text-text-muted line-through' : 'text-gold neon-text-gold',
                  )}
                >
                  {formatCurrency(item.price)}
                </span>
                {isSold && (
                  <span className="rounded-lg border-2 border-danger px-2.5 py-0.5 font-display text-sm font-black tracking-[0.2em] text-danger">
                    SOLD
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                {isSold
                  ? 'Con này đã có người mua. Mỗi mã chỉ có một con — xem những con khác bên dưới nhé.'
                  : 'Mỗi mã chỉ có một con duy nhất — ai đặt trước thì được.'}
              </p>
              {isUpcoming && (
                <div className="mt-4 border-t border-gold/20 pt-4">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-gold">
                    <Clock size={16} aria-hidden="true" />
                    Mở bán lúc {item.feedOpensAt ? formatDateTime(item.feedOpensAt) : 'sắp tới'}
                  </p>
                  {item.feedOpensAt && (
                    <Countdown
                      targetIso={item.feedOpensAt}
                      size="md"
                      finishedLabel="Đã mở bán — tải lại trang để chốt đơn"
                      className="mt-3"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Thông tin con này */}
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">Hệ</dt>
                <dd className="mt-1 text-sm font-semibold text-text">
                  {item.attribute ? <AttributeBadge attribute={item.attribute} /> : 'Chưa rõ'}
                </dd>
              </div>
              <div className="rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">Dòng sản phẩm</dt>
                <dd className="mt-1 text-sm font-semibold text-text">
                  {series?.label ?? 'Chưa rõ'}
                </dd>
              </div>
              <div className="col-span-2 rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">Tình trạng</dt>
                <dd className="mt-1 text-sm leading-relaxed font-semibold whitespace-pre-line text-text">
                  {item.condition || (
                    <span className="font-normal text-text-muted">Shop chưa ghi tình trạng.</span>
                  )}
                </dd>
              </div>
            </dl>

            {/* Mua */}
            <div className="mt-6 flex gap-2.5 sm:gap-3">
              {isSold || isUpcoming ? (
                <Button size="lg" variant="secondary" disabled className={buyButtonClass}>
                  {isSold ? 'Đã bán' : 'Chưa mở bán'}
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant="secondary"
                    className={buyButtonClass}
                    leftIcon={
                      inCart ? (
                        <Check size={18} className="hidden sm:block" />
                      ) : (
                        <ShoppingCart size={18} className="hidden sm:block" />
                      )
                    }
                    onClick={handleAdd}
                  >
                    {inCart ? 'Đã trong giỏ' : 'Thêm vào giỏ'}
                  </Button>
                  <Button size="lg" className={buyButtonClass} onClick={handleBuyNow}>
                    Mua ngay
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={handleWishlist}
                aria-label={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                aria-pressed={isWishlisted}
                className={cn(
                  'shrink-0 rounded-xl border px-4 transition',
                  isWishlisted
                    ? 'border-accent-pink/60 bg-accent-pink/15 text-accent-pink'
                    : 'border-white/10 bg-surface-2 text-text-muted hover:border-accent-pink/50 hover:text-accent-pink',
                )}
              >
                <Heart size={20} className={cn(isWishlisted && 'fill-current')} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <button
                type="button"
                onClick={() => openChat({ prefill: `Mình hỏi về ${item.code} (${item.name}): ` })}
                className="inline-flex items-center gap-1.5 font-semibold text-accent-cyan hover:underline"
              >
                <MessageCircle size={16} aria-hidden="true" />
                Hỏi shop về con này
              </button>
              {inCart && (
                <Link
                  to={ROUTES.cart}
                  className="inline-flex items-center gap-1.5 font-semibold text-text-muted transition hover:text-accent-cyan"
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  Xem giỏ hàng
                </Link>
              )}
            </div>

            <ul className="mt-6 space-y-2.5 rounded-2xl border border-white/8 bg-surface/60 p-5">
              {GUARANTEES.map((entry) => (
                <li key={entry.text} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <entry.icon
                    size={15}
                    className="mt-0.5 shrink-0 text-accent-cyan"
                    aria-hidden="true"
                  />
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-14" aria-labelledby="same-feed">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="same-feed" className="font-display text-xl font-bold text-text">
                  Các con khác trong feed #{feed.number}
                </h2>
                <p className="mt-1 text-xs text-text-muted">{feed.title}</p>
              </div>
              <Link
                to={ROUTES.feedDetail(feed.number)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
              >
                Xem cả feed ({feed.itemCount} con)
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <SnapSlider
              label={`Các con khác trong feed #${feed.number}`}
              itemClassName="w-[46%] sm:w-[calc((100%-40px)/3)] lg:w-[calc((100%-60px)/4)]"
            >
              {others.map((entry) => (
                <ItemCard key={entry.id} item={entry} className="h-full" />
              ))}
            </SnapSlider>
          </section>
        )}
      </Container>
    </>
  );
}

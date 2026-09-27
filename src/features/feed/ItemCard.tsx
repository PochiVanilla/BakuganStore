import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Check, Heart, ShoppingCart, Zap } from 'lucide-react';
import type { BakuganItem } from '@/types';
import { ROUTES } from '@/constants/routes';
import { CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import { formatCurrency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { AttributeBadge, RefImage } from '@/components/ui';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from '@/store/uiStore';

interface ItemCardProps {
  item: BakuganItem;
  /** Hiện dòng "Feed #28" (khi xem ngoài trang feed, VD kết quả tìm kiếm) */
  showFeed?: boolean;
  /** Được trỏ tới từ đường dẫn #BK-0231 */
  highlighted?: boolean;
  className?: string;
}

/** Một con Bakugan duy nhất: tên + mã, tình trạng riêng, SOLD khi đã bán. */
function ItemCardComponent({
  item,
  showFeed = false,
  highlighted = false,
  className,
}: ItemCardProps) {
  const inCart = useCartStore((state) => state.items.some((entry) => entry.itemId === item.id));
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const isWishlisted = useWishlistStore((state) => state.itemIds.includes(item.id));
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  const isSold = item.status === 'sold';
  /** Còn hàng nhưng feed chưa tới giờ mở bán */
  const isUpcoming = !isSold && !item.onSale;
  const series = item.series ? SERIES_META[item.series] : undefined;

  const handleAdd = (): void => {
    if (inCart) {
      openDrawer();
      return;
    }
    addItem(item);
    toast.success(`Đã thêm ${item.code} vào giỏ`, item.name);
  };

  const handleWishlist = (): void => {
    toggleWishlist(item.id);
    toast.info(isWishlisted ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', item.code);
  };

  return (
    <article
      id={item.code}
      className={cn(
        'group relative flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border bg-surface/80 transition-colors duration-300',
        highlighted
          ? 'border-accent-cyan shadow-glow-cyan'
          : 'border-white/8 hover:border-accent-cyan/35',
        className,
      )}
    >
      <div className="relative">
        <RefImage
          src={item.image}
          alt={`${item.name} ${item.code}`}
          width={600}
          height={600}
          loading="lazy"
          decoding="async"
          className={cn('aspect-square w-full object-cover', isSold && 'opacity-40 grayscale')}
        />
        <span className="absolute top-2.5 left-2.5 rounded-md border border-white/15 bg-background/85 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-accent-cyan backdrop-blur">
          {item.code}
        </span>
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={isWishlisted ? `Bỏ ${item.code} khỏi yêu thích` : `Yêu thích ${item.code}`}
          aria-pressed={isWishlisted}
          className={cn(
            'absolute top-2 right-2 rounded-full border p-2 backdrop-blur transition',
            isWishlisted
              ? 'border-accent-pink/60 bg-accent-pink/20 text-accent-pink'
              : 'border-white/15 bg-background/70 text-text-muted hover:text-accent-pink',
          )}
        >
          <Heart size={14} className={cn(isWishlisted && 'fill-current')} />
        </button>
        {isSold && (
          <span className="absolute inset-0 flex items-center justify-center" aria-label="Đã bán">
            <span className="-rotate-12 rounded-lg border-2 border-danger px-4 py-1 font-display text-2xl font-black tracking-[0.2em] text-danger shadow-[0_0_24px_rgba(255,77,106,0.35)]">
              SOLD
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {showFeed && item.feedNumber && (
          <Link
            to={ROUTES.feedDetail(item.feedNumber, item.code)}
            className="mb-1 text-[11px] font-semibold text-text-muted transition hover:text-accent-cyan"
          >
            Feed #{item.feedNumber}
          </Link>
        )}
        <h3 className="line-clamp-2 font-display text-sm leading-snug font-bold text-text">
          {item.name}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AttributeBadge attribute={item.attribute} size="sm" />
          {series && <span className="text-[11px] text-text-muted">{series.label}</span>}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-semibold text-text">{CONDITION_LABELS[item.condition]}</span>
          {item.conditionNote && ` — ${item.conditionNote}`}
        </p>
        {item.gPower && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-gold">
            <Zap size={12} aria-hidden="true" />
            {formatNumber(item.gPower)} G
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-3">
          <p
            className={cn(
              'font-display text-base font-extrabold',
              isSold ? 'text-text-muted line-through' : 'text-gold',
            )}
          >
            {formatCurrency(item.price)}
          </p>
          {isSold ? (
            <span className="rounded-lg bg-danger/12 px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-danger">
              Đã bán
            </span>
          ) : isUpcoming ? (
            <span className="rounded-lg bg-gold/12 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-gold">
              Chưa mở bán
            </span>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition',
                inCart
                  ? 'border border-success/45 bg-success/12 text-success'
                  : 'gradient-cta text-white hover:brightness-110',
              )}
            >
              {inCart ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <ShoppingCart size={14} aria-hidden="true" />
              )}
              {inCart ? 'Trong giỏ' : 'Thêm vào giỏ'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export const ItemCard = memo(ItemCardComponent);

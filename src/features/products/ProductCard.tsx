import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { ROUTES } from '@/constants/routes';
import { CONDITION_LABELS } from '@/constants/catalog';
import { calcDiscountPercent, formatCurrency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { AttributeBadge, StatusBadge, Rating } from '@/components/ui';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from '@/store/uiStore';
import { getProductBadges } from './productBadges';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'list';
  className?: string;
}

function ProductCardComponent({ product, layout = 'grid', className }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const wishlistIds = useWishlistStore((state) => state.productIds);
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  const isWishlisted = wishlistIds.includes(product.id);
  const badges = getProductBadges(product);
  const discount = calcDiscountPercent(product.price, product.originalPrice);
  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = (): void => {
    if (isOutOfStock) return;
    addItem(product, 1);
    openDrawer();
    toast.success('Đã thêm vào giỏ hàng', product.name);
  };

  const handleToggleWishlist = (): void => {
    toggleWishlist(product.id);
    toast.info(isWishlisted ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', product.name);
  };

  if (layout === 'list') {
    return (
      <article
        className={cn(
          'group flex flex-col gap-4 rounded-2xl border border-white/8 bg-surface/80 p-4 transition-all duration-300 hover:border-accent-cyan/40 sm:flex-row',
          className,
        )}
      >
        <Link
          to={ROUTES.productDetail(product.slug)}
          className="relative w-full shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-48"
        >
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={600}
            height={600}
            className={cn(
              'aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105',
              isOutOfStock && 'opacity-45 grayscale',
            )}
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {badges.map((badge) => (
              <StatusBadge key={badge} type={badge} />
            ))}
            <AttributeBadge attribute={product.attribute} size="sm" />
          </div>

          <Link to={ROUTES.productDetail(product.slug)}>
            <h3 className="font-display text-base font-bold text-text transition-colors group-hover:text-accent-cyan">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">{product.shortDescription}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 text-gold">
              <Zap size={13} aria-hidden="true" />
              {formatNumber(product.gPower)} G
            </span>
            <span>{CONDITION_LABELS[product.condition]}</span>
            <span>Đã bán {formatNumber(product.soldCount)}</span>
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
            <div>
              <p className="font-display text-xl font-extrabold text-gold neon-text-gold">
                {formatCurrency(product.price)}
              </p>
              {product.originalPrice && (
                <p className="text-sm text-text-muted line-through">
                  {formatCurrency(product.originalPrice)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleWishlist}
                aria-label={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                aria-pressed={isWishlisted}
                className={cn(
                  'rounded-xl border p-2.5 transition',
                  isWishlisted
                    ? 'border-accent-pink/60 bg-accent-pink/15 text-accent-pink'
                    : 'border-white/10 bg-surface-2 text-text-muted hover:border-accent-pink/50 hover:text-accent-pink',
                )}
              >
                <Heart size={16} className={cn(isWishlisted && 'fill-current')} />
              </button>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="inline-flex h-10 items-center gap-2 rounded-xl gradient-cta px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingCart size={16} />
                {isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-surface/80 transition-colors duration-300 hover:border-accent-cyan/40 hover:shadow-[0_18px_44px_-22px_rgba(123,75,232,0.9)]',
        className,
      )}
    >
      <div className="relative overflow-hidden bg-surface-2">
        <Link to={ROUTES.productDetail(product.slug)} aria-label={product.name}>
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={600}
            height={600}
            className={cn(
              'aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-110',
              isOutOfStock && 'opacity-45 grayscale',
            )}
          />
        </Link>

        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {badges.map((badge) => (
            <StatusBadge key={badge} type={badge} />
          ))}
        </div>

        {discount > 0 && (
          <span className="absolute top-2.5 right-2.5 rounded-lg bg-gold px-2 py-1 font-display text-xs font-extrabold text-background">
            -{discount}%
          </span>
        )}

        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
          aria-pressed={isWishlisted}
          className={cn(
            'absolute right-2.5 bottom-2.5 rounded-xl border p-2.5 backdrop-blur transition',
            isWishlisted
              ? 'border-accent-pink/60 bg-accent-pink/20 text-accent-pink'
              : 'border-white/10 bg-background/70 text-text-muted opacity-0 group-hover:opacity-100 hover:border-accent-pink/50 hover:text-accent-pink focus-visible:opacity-100',
          )}
        >
          <Heart size={16} className={cn(isWishlisted && 'fill-current')} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <AttributeBadge attribute={product.attribute} size="sm" />
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
            <Zap size={12} aria-hidden="true" />
            {formatNumber(product.gPower)}G
          </span>
        </div>

        <Link to={ROUTES.productDetail(product.slug)} className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm leading-snug font-bold text-text transition-colors group-hover:text-accent-cyan">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1.5 text-xs text-text-muted">{CONDITION_LABELS[product.condition]}</p>

        <div className="mt-2">
          <Rating value={product.rating} count={product.reviewCount} size={12} />
        </div>

        <div className="mt-auto pt-3.5">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-lg font-extrabold text-gold">
              {formatCurrency(product.price)}
            </p>
            {product.originalPrice && (
              <p className="text-xs text-text-muted line-through">
                {formatCurrency(product.originalPrice)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              'mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
              isOutOfStock
                ? 'cursor-not-allowed border border-white/10 bg-white/5 text-text-muted'
                : 'gradient-cta text-white hover:shadow-glow-pink hover:brightness-110',
            )}
          >
            <ShoppingCart size={16} />
            {isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export const ProductCard = memo(ProductCardComponent);

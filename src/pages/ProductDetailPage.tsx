import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Heart,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import {
  ATTRIBUTE_META,
  CONDITION_DESCRIPTIONS,
  CONDITION_LABELS,
  SERIES_META,
} from '@/constants/catalog';
import {
  fetchProductBySlug,
  fetchProductReviews,
  fetchRelatedProducts,
} from '@/services/api/productService';
import { useAsync } from '@/hooks/useAsync';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from '@/store/uiStore';
import { calcDiscountPercent, formatCurrency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  AttributeBadge,
  Button,
  Container,
  EmptyState,
  Rating,
  SectionHeading,
  Seo,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { ProductCard } from '@/features/products/ProductCard';
import { ProductGallery } from '@/features/products/ProductGallery';
import { ProductTabs } from '@/features/products/ProductTabs';
import { getProductBadges } from '@/features/products/productBadges';

const GUARANTEES = [
  { icon: ShieldCheck, text: 'Hàng chính hãng, đã kiểm tra cơ cấu bung nở' },
  { icon: Package, text: 'Đóng gói chống sốc hai lớp, có video khi đóng hàng' },
  { icon: Truck, text: 'Giao toàn quốc, miễn phí ship cho đơn từ 800.000₫' },
  { icon: RefreshCw, text: 'Đổi trả trong 7 ngày nếu lỗi từ nhà sản xuất' },
];

function DetailSkeleton() {
  return (
    <Container className="py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </Container>
  );
}

export default function ProductDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, error } = useAsync(() => fetchProductBySlug(slug), [slug]);
  const { data: reviews } = useAsync(() => fetchProductReviews(product?.id ?? ''), [product?.id], {
    enabled: Boolean(product?.id),
  });
  const { data: related } = useAsync(() => fetchRelatedProducts(slug, 4), [slug]);

  const addItem = useCartStore((state) => state.addItem);
  const openCartDrawer = useCartStore((state) => state.openDrawer);
  const wishlistIds = useWishlistStore((state) => state.productIds);
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  if (isLoading) return <DetailSkeleton />;

  if (error || !product) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description={error ?? 'Sản phẩm này có thể đã được gỡ khỏi cửa hàng.'}
          action={
            <Button onClick={() => navigate(ROUTES.products)}>Quay lại danh sách sản phẩm</Button>
          }
        />
      </Container>
    );
  }

  const isWishlisted = wishlistIds.includes(product.id);
  const isOutOfStock = product.stock <= 0;
  const discount = calcDiscountPercent(product.price, product.originalPrice);
  const badges = getProductBadges(product);
  const attributeMeta = ATTRIBUTE_META[product.attribute];
  const seriesMeta = SERIES_META[product.series];

  const handleAddToCart = (): void => {
    addItem(product, quantity);
    openCartDrawer();
    toast.success('Đã thêm vào giỏ hàng', `${product.name} × ${quantity}`);
  };

  const handleBuyNow = (): void => {
    addItem(product, quantity);
    navigate(ROUTES.cart);
  };

  return (
    <>
      <Seo
        title={product.name}
        description={product.shortDescription}
        image={product.images[0]}
        path={ROUTES.productDetail(product.slug)}
        type="product"
      />

      <Container className="py-6 sm:py-10">
        {/* Breadcrumb */}
        <nav
          aria-label="Đường dẫn"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-text-muted"
        >
          <Link to={ROUTES.home} className="transition hover:text-accent-cyan">
            Trang chủ
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to={ROUTES.products} className="transition hover:text-accent-cyan">
            Sản phẩm
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link
            to={`${ROUTES.products}?he=${product.attribute}`}
            className="transition hover:text-accent-cyan"
          >
            {attributeMeta.label}
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="truncate text-text">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductGallery images={product.images} alt={product.name} />

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {badges.map((badge) => (
                <StatusBadge key={badge} type={badge} />
              ))}
              <AttributeBadge attribute={product.attribute} />
            </div>

            <h1 className="font-display text-2xl leading-tight font-extrabold text-text sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Rating value={product.rating} count={product.reviewCount} />
              <span className="text-sm text-text-muted">
                Đã bán {formatNumber(product.soldCount)}
              </span>
              <span
                className={cn('text-sm font-medium', isOutOfStock ? 'text-danger' : 'text-success')}
              >
                {isOutOfStock ? 'Tạm hết hàng' : `Còn ${product.stock} sản phẩm`}
              </span>
            </div>

            {/* Giá */}
            <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/5 p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-3xl font-black text-gold neon-text-gold">
                  {formatCurrency(product.price)}
                </span>
                {product.originalPrice && (
                  <>
                    <span className="text-base text-text-muted line-through">
                      {formatCurrency(product.originalPrice)}
                    </span>
                    <span className="rounded-lg bg-gold px-2 py-0.5 font-display text-xs font-extrabold text-background">
                      -{discount}%
                    </span>
                  </>
                )}
              </div>
              {product.originalPrice && (
                <p className="mt-1.5 text-xs text-text-muted">
                  Tiết kiệm {formatCurrency(product.originalPrice - product.price)} so với giá gốc.
                </p>
              )}
            </div>

            {/* Thông tin sưu tầm */}
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">Hệ</dt>
                <dd className="mt-1 text-sm font-semibold text-text">
                  {attributeMeta.label} — {attributeMeta.element}
                </dd>
              </div>
              <div className="rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">G-Power</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                  <Zap size={14} aria-hidden="true" />
                  {formatNumber(product.gPower)} G
                </dd>
              </div>
              <div className="rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">Dòng sản phẩm</dt>
                <dd className="mt-1 text-sm font-semibold text-text">{seriesMeta.label}</dd>
              </div>
              <div className="rounded-xl border border-white/8 bg-surface/70 p-3.5">
                <dt className="text-xs text-text-muted">Tình trạng</dt>
                <dd className="mt-1 text-sm font-semibold text-text">
                  {CONDITION_LABELS[product.condition]}
                </dd>
              </div>
            </dl>

            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              {CONDITION_DESCRIPTIONS[product.condition]}
            </p>

            {/* Phụ kiện kèm theo */}
            <section className="mt-5">
              <h2 className="mb-2.5 font-display text-sm font-bold text-text">Phụ kiện kèm theo</h2>
              <ul className="flex flex-wrap gap-2">
                {product.accessories.map((accessory) => (
                  <li
                    key={accessory.name}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                      accessory.included
                        ? 'border-success/35 bg-success/8 text-success'
                        : 'border-white/8 bg-white/3 text-text-muted/60 line-through',
                    )}
                  >
                    {accessory.included ? (
                      <Check size={12} aria-hidden="true" />
                    ) : (
                      <X size={12} aria-hidden="true" />
                    )}
                    {accessory.name}
                  </li>
                ))}
              </ul>
            </section>

            {/* Số lượng + hành động */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-xl border border-white/10 bg-surface-2">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  aria-label="Giảm số lượng"
                  className="p-3 text-text-muted transition hover:text-accent-cyan disabled:opacity-35"
                >
                  <Minus size={15} />
                </button>
                <span
                  className="min-w-10 text-center font-display font-bold text-text tabular-nums"
                  aria-live="polite"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}
                  disabled={quantity >= product.stock || isOutOfStock}
                  aria-label="Tăng số lượng"
                  className="p-3 text-text-muted transition hover:text-accent-cyan disabled:opacity-35"
                >
                  <Plus size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  toggleWishlist(product.id);
                  toast.info(
                    isWishlisted ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích',
                    product.name,
                  );
                }}
                aria-label={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                aria-pressed={isWishlisted}
                className={cn(
                  'rounded-xl border p-3 transition',
                  isWishlisted
                    ? 'border-accent-pink/60 bg-accent-pink/15 text-accent-pink'
                    : 'border-white/10 bg-surface-2 text-text-muted hover:border-accent-pink/50 hover:text-accent-pink',
                )}
              >
                <Heart size={18} className={cn(isWishlisted && 'fill-current')} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                fullWidth
                disabled={isOutOfStock}
                leftIcon={<ShoppingCart size={18} />}
                onClick={handleAddToCart}
              >
                Thêm vào giỏ
              </Button>
              <Button size="lg" fullWidth disabled={isOutOfStock} onClick={handleBuyNow}>
                {isOutOfStock ? 'Tạm hết hàng' : 'Mua ngay'}
              </Button>
            </div>

            <ul className="mt-6 space-y-2.5 rounded-2xl border border-white/8 bg-surface/60 p-5">
              {GUARANTEES.map((item) => (
                <li key={item.text} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <item.icon
                    size={15}
                    className="mt-0.5 shrink-0 text-accent-cyan"
                    aria-hidden="true"
                  />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ProductTabs product={product} reviews={reviews ?? []} />

        {related && related.length > 0 && (
          <section className="mt-16">
            <SectionHeading
              eyebrow="GỢI Ý CHO BẠN"
              title="Sản phẩm liên quan"
              description={`Cùng hệ ${attributeMeta.label} hoặc cùng dòng ${seriesMeta.label}.`}
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}

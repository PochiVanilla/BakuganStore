import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  LockKeyhole,
  ShoppingBag,
  Tag,
  Trash2,
  TriangleAlert,
  Truck,
  X,
} from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD, ROUTES } from '@/constants/routes';
import { CONDITION_LABELS } from '@/constants/catalog';
import {
  applyCoupon,
  calculateTotals,
  DEFAULT_CHECKOUT_CONFIG,
  fetchCheckoutConfig,
} from '@/services/api/orderService';
import { fetchItemsByIds } from '@/services/api/feedService';
import { getApiErrorMessage } from '@/services/api/client';
import { MOCK_COUPONS } from '@/mocks';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/uiStore';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  AttributeBadge,
  Button,
  ButtonLink,
  Container,
  EmptyState,
  RefImage,
  Seo,
} from '@/components/ui';
import { CardBrandMarks } from '@/features/checkout/CardBrandMarks';
import { CheckoutSteps } from '@/features/checkout/CheckoutSteps';

export default function CartPage() {
  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const coupon = useCartStore((state) => state.coupon);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const removeItem = useCartStore((state) => state.removeItem);
  const removeMany = useCartStore((state) => state.removeMany);
  const clear = useCartStore((state) => state.clear);
  const revision = useLiveRevision();
  const config = useAsync(() => fetchCheckoutConfig(), [revision], { keepPreviousData: true });
  const intlAvailable = Boolean(
    config.data && config.data.cardPayments && config.data.international.enabled,
  );

  const [couponCode, setCouponCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Đã đăng nhập và có hàng -> tải sẵn trang thanh toán để bấm là hiện ngay.
  const readyToCheckout = Boolean(user) && items.length > 0;
  useEffect(() => {
    if (readyToCheckout) void import('@/pages/CheckoutPage').catch(() => undefined);
  }, [readyToCheckout]);

  // Kiểm tra lại từng con: có ai vừa chốt trước không, feed đã tới giờ mở bán chưa.
  const idsKey = items.map((item) => item.itemId).join(',');
  const live = useAsync(
    () => fetchItemsByIds(items.map((item) => item.itemId)),
    [idsKey, revision],
    { enabled: items.length > 0, keepPreviousData: true },
  );
  const liveById = new Map((live.data ?? []).map((item) => [item.id, item]));
  const unavailable = live.data
    ? items.filter((item) => {
        const current = liveById.get(item.itemId);
        return !current || current.status === 'sold';
      })
    : [];
  const notOpenYet = items.filter((item) => {
    const current = liveById.get(item.itemId);
    return current && current.status === 'available' && !current.onSale;
  });
  const buyable = items.filter((item) => !unavailable.includes(item) && !notOpenYet.includes(item));

  // Ước tính theo giao trong nước; gửi ra nước ngoài thì tính lại ở bước thanh toán.
  const totals = calculateTotals(
    buyable,
    coupon,
    undefined,
    config.data ?? DEFAULT_CHECKOUT_CONFIG,
  );
  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.subtotal);

  const handleApplyCoupon = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!couponCode.trim()) return;
    setIsApplying(true);
    try {
      const applied = await applyCoupon(couponCode, totals.subtotal);
      setCoupon(applied);
      setCouponCode('');
      toast.success('Áp dụng mã thành công', applied.label);
    } catch (error) {
      toast.error('Mã giảm giá không dùng được', getApiErrorMessage(error));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      <Seo
        title="Giỏ hàng"
        description="Xem lại những con Bakugan bạn đã chọn và chốt đơn."
        path={ROUTES.cart}
        noIndex
      />

      <Container className="py-8 sm:py-12">
        {items.length > 0 && <CheckoutSteps current={0} />}
        <>
          <h1 className="mb-8 font-display text-3xl font-extrabold text-text sm:text-4xl">
            Giỏ hàng
            {items.length > 0 && (
              <span className="ml-3 text-base font-medium text-text-muted">
                ({items.length} con)
              </span>
            )}
          </h1>

          {items.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={26} aria-hidden="true" />}
              title="Giỏ hàng đang trống"
              description="Mở một feed, chọn những con bạn thích rồi bấm Thêm vào giỏ nhé!"
              action={<ButtonLink to={ROUTES.feeds}>Xem feed đang bán</ButtonLink>}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              <div>
                {unavailable.length > 0 && (
                  <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-danger/35 bg-danger/10 p-4 text-sm text-danger"
                  >
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      {unavailable.map((item) => item.code).join(', ')} vừa có người chốt trước
                      (SOLD).
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMany(unavailable.map((item) => item.itemId))}
                      className="font-semibold underline underline-offset-2"
                    >
                      Bỏ khỏi giỏ
                    </button>
                  </div>
                )}
                {notOpenYet.length > 0 && (
                  <p className="mb-4 rounded-xl border border-gold/30 bg-gold/8 p-4 text-sm text-gold">
                    {notOpenYet.map((item) => item.code).join(', ')} thuộc feed chưa tới giờ mở bán
                    — tới giờ bạn quay lại chốt nhé.
                  </p>
                )}
                {remainingForFreeShip > 0 && buyable.length > 0 && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-text-muted">
                    <Truck size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                    <span>
                      Thêm{' '}
                      <strong className="text-gold">{formatCurrency(remainingForFreeShip)}</strong>{' '}
                      nữa để được miễn phí vận chuyển toàn quốc.
                    </span>
                  </div>
                )}

                <ul className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-surface/70">
                  {items.map((item) => {
                    const isGone = unavailable.includes(item);
                    const link = ROUTES.itemDetail(item.code);
                    return (
                      <li key={item.itemId} className="flex gap-4 p-4 sm:p-5">
                        <Link to={link} className="relative shrink-0">
                          <RefImage
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            width={96}
                            height={96}
                            className={cn(
                              'h-20 w-20 rounded-xl bg-surface-2 object-cover sm:h-24 sm:w-24',
                              isGone && 'opacity-40 grayscale',
                            )}
                          />
                          {isGone && (
                            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-black text-danger">
                              SOLD
                            </span>
                          )}
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold text-accent-cyan">
                                {item.code}
                                {item.feedNumber && (
                                  <span className="font-sans font-normal text-text-muted">
                                    {' '}
                                    · Feed #{item.feedNumber}
                                  </span>
                                )}
                              </p>
                              <Link
                                to={link}
                                className="line-clamp-2 text-sm font-semibold text-text transition hover:text-accent-cyan sm:text-base"
                              >
                                {item.name}
                              </Link>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <AttributeBadge attribute={item.attribute} size="sm" />
                                <span className="text-xs text-text-muted">
                                  {CONDITION_LABELS[item.condition]}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                removeItem(item.itemId);
                                toast.info('Đã bỏ khỏi giỏ hàng', item.code);
                              }}
                              aria-label={`Bỏ ${item.code} khỏi giỏ hàng`}
                              className="shrink-0 rounded-lg p-2 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p
                            className={cn(
                              'mt-auto pt-3 text-right font-display text-lg font-extrabold',
                              isGone ? 'text-text-muted line-through' : 'text-gold',
                            )}
                          >
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 flex flex-wrap gap-3">
                  <ButtonLink to={ROUTES.feeds} variant="ghost">
                    ← Chọn thêm ở các feed
                  </ButtonLink>
                  <Button
                    variant="danger"
                    leftIcon={<Trash2 size={15} />}
                    onClick={() => {
                      clear();
                      toast.info('Đã xoá toàn bộ giỏ hàng');
                    }}
                  >
                    Xoá toàn bộ giỏ hàng
                  </Button>
                </div>
              </div>

              <aside className="lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-2xl border border-white/8 bg-surface/80 p-5">
                  <h2 className="font-display text-base font-bold text-text">Tóm tắt đơn hàng</h2>
                  <dl className="mt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Tạm tính ({buyable.length} con)</dt>
                      <dd className="font-medium text-text">{formatCurrency(totals.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Phí vận chuyển trong nước</dt>
                      <dd className="font-medium text-text">
                        {totals.shippingFee === 0 ? (
                          <span className="text-success">Miễn phí</span>
                        ) : (
                          formatCurrency(totals.shippingFee)
                        )}
                      </dd>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-muted">Giảm giá</dt>
                        <dd className="font-medium text-success">
                          −{formatCurrency(totals.discount)}
                        </dd>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-3 border-t border-white/8 pt-3">
                      <dt className="font-display font-bold text-text">Tổng cộng</dt>
                      <dd className="font-display text-2xl font-extrabold text-gold neon-text-gold">
                        {formatCurrency(totals.total)}
                      </dd>
                    </div>
                  </dl>
                  {intlAvailable && (
                    <p className="mt-3 flex items-start gap-2 text-xs text-text-muted">
                      <Globe
                        size={14}
                        className="mt-0.5 shrink-0 text-accent-cyan"
                        aria-hidden="true"
                      />
                      Gửi ra nước ngoài? Chọn ở bước thanh toán — phí gửi tính theo nước nhận, trả
                      bằng thẻ.
                    </p>
                  )}

                  {!user ? (
                    <>
                      <p className="mt-5 text-sm text-text-muted">
                        Đăng nhập để thanh toán và theo dõi đơn. Mỗi con Bakugan chỉ có một, ai chốt
                        trước được trước!
                      </p>
                      <ButtonLink
                        to={ROUTES.login}
                        state={{ from: { pathname: ROUTES.checkout } }}
                        size="lg"
                        fullWidth
                        className="mt-3"
                      >
                        Đăng nhập để thanh toán
                      </ButtonLink>
                      <p className="mt-2 text-center text-xs text-text-muted">
                        Chưa có tài khoản?{' '}
                        <Link
                          to={ROUTES.register}
                          className="font-semibold text-accent-cyan hover:underline"
                        >
                          Đăng ký
                        </Link>
                      </p>
                    </>
                  ) : buyable.length > 0 ? (
                    <ButtonLink
                      to={ROUTES.checkout}
                      size="lg"
                      fullWidth
                      className="mt-5"
                      leftIcon={<LockKeyhole size={17} />}
                    >
                      Tiến hành thanh toán
                    </ButtonLink>
                  ) : (
                    <Button size="lg" fullWidth className="mt-5" disabled>
                      Tiến hành thanh toán
                    </Button>
                  )}

                  <div className="mt-4 text-xs text-text-muted">
                    <p>Nhận COD, chuyển khoản, MoMo</p>
                    {(config.data?.cardPayments ?? true) && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-2">
                        và thẻ <CardBrandMarks />
                      </p>
                    )}
                  </div>

                  {/* Mã giảm giá */}
                  <form onSubmit={handleApplyCoupon} className="mt-5 border-t border-white/8 pt-4">
                    <label htmlFor="coupon-code" className="mb-1.5 block text-sm text-text-muted">
                      Mã giảm giá
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="coupon-code"
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                        placeholder="Nhập mã"
                        className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-2 px-3.5 text-sm text-text uppercase transition outline-none placeholder:text-text-muted/60 placeholder:normal-case focus:border-accent-cyan"
                      />
                      <Button type="submit" variant="secondary" isLoading={isApplying}>
                        Áp dụng
                      </Button>
                    </div>
                    {coupon && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-success/35 bg-success/10 p-2.5 text-xs text-success">
                        <Tag size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span className="flex-1">
                          <strong>{coupon.code}</strong> — {coupon.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCoupon(null);
                            toast.info('Đã gỡ mã giảm giá');
                          }}
                          aria-label="Gỡ mã giảm giá"
                          className="shrink-0 transition hover:text-text"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    <details className="mt-2.5">
                      <summary className="cursor-pointer text-xs text-text-muted transition hover:text-accent-cyan">
                        Xem mã đang có
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {MOCK_COUPONS.map((item) => (
                          <li key={item.code}>
                            <button
                              type="button"
                              onClick={() => setCouponCode(item.code)}
                              className="w-full rounded-lg border border-dashed border-white/12 px-2.5 py-2 text-left text-xs text-text-muted transition hover:border-gold/40 hover:text-gold"
                            >
                              <strong className="text-gold">{item.code}</strong> — {item.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </form>
                </div>
              </aside>
            </div>
          )}
        </>
      </Container>
    </>
  );
}

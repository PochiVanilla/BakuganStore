import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Tag, Trash2, Truck, X } from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD, ROUTES } from '@/constants/routes';
import { CONDITION_LABELS } from '@/constants/catalog';
import { applyCoupon, calculateTotals } from '@/services/api/orderService';
import { getApiErrorMessage } from '@/services/api/client';
import { MOCK_COUPONS } from '@/mocks';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/uiStore';
import { formatCurrency } from '@/utils/format';
import { AttributeBadge, Button, ButtonLink, Container, EmptyState, Seo } from '@/components/ui';

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const coupon = useCartStore((state) => state.coupon);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);

  const [couponCode, setCouponCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const totals = calculateTotals(items, coupon);
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

  const handleCheckout = (): void => {
    toast.info(
      'Chức năng thanh toán đang phát triển',
      'Phần này sẽ được nối với backend TypeScript ở giai đoạn sau.',
    );
  };

  return (
    <>
      <Seo
        title="Giỏ hàng"
        description="Xem lại các sản phẩm Bakugan trong giỏ hàng của bạn và tiến hành thanh toán."
        path={ROUTES.cart}
        noIndex
      />

      <Container className="py-8 sm:py-12">
        <h1 className="mb-8 font-display text-3xl font-extrabold text-text sm:text-4xl">
          Giỏ hàng
          {items.length > 0 && (
            <span className="ml-3 text-base font-medium text-text-muted">
              ({items.length} sản phẩm)
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={26} aria-hidden="true" />}
            title="Giỏ hàng đang trống"
            description="Chưa có chiến binh nào trong giỏ. Ghé qua bộ sưu tập để chọn cho mình vài quả nhé!"
            action={<ButtonLink to={ROUTES.products}>Khám phá sản phẩm</ButtonLink>}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Danh sách sản phẩm */}
            <div>
              {remainingForFreeShip > 0 && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold/25 bg-gold/8 p-4 text-sm text-gold">
                  <Truck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Mua thêm <strong>{formatCurrency(remainingForFreeShip)}</strong> để được miễn
                    phí vận chuyển toàn quốc.
                  </span>
                </div>
              )}

              <ul className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-surface/70">
                {items.map((item) => (
                  <li key={item.productId} className="flex gap-4 p-4 sm:p-5">
                    <Link to={ROUTES.productDetail(item.slug)} className="shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        width={96}
                        height={96}
                        className="h-20 w-20 rounded-xl bg-surface-2 object-cover sm:h-24 sm:w-24"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={ROUTES.productDetail(item.slug)}
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
                            removeItem(item.productId);
                            toast.info('Đã xoá khỏi giỏ hàng', item.name);
                          }}
                          aria-label={`Xoá ${item.name} khỏi giỏ hàng`}
                          className="shrink-0 rounded-lg p-2 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                        <div className="flex items-center rounded-lg border border-white/10 bg-surface-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            aria-label={`Giảm số lượng ${item.name}`}
                            className="p-2 text-text-muted transition hover:text-accent-cyan"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold text-text tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.maxQuantity}
                            aria-label={`Tăng số lượng ${item.name}`}
                            className="p-2 text-text-muted transition hover:text-accent-cyan disabled:opacity-35"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="font-display text-lg font-extrabold text-gold">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-text-muted">
                              {formatCurrency(item.price)} × {item.quantity}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-3">
                <ButtonLink to={ROUTES.products} variant="ghost">
                  ← Tiếp tục mua sắm
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

            {/* Tóm tắt đơn hàng */}
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-2xl border border-white/8 bg-surface/80 p-5">
                <h2 className="font-display text-base font-bold text-text">Tóm tắt đơn hàng</h2>

                {/* Mã giảm giá */}
                <form onSubmit={handleApplyCoupon} className="mt-4">
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

                <dl className="mt-5 space-y-2.5 border-t border-white/8 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Tạm tính</dt>
                    <dd className="font-medium text-text">{formatCurrency(totals.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Phí vận chuyển</dt>
                    <dd className="font-medium text-text">
                      {totals.shippingFee === 0 ? (
                        <span className="text-success">Miễn phí</span>
                      ) : (
                        formatCurrency(totals.shippingFee)
                      )}
                    </dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Giảm giá</dt>
                      <dd className="font-medium text-success">
                        −{formatCurrency(totals.discount)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-white/8 pt-3">
                    <dt className="font-display font-bold text-text">Tổng cộng</dt>
                    <dd className="font-display text-2xl font-extrabold text-gold neon-text-gold">
                      {formatCurrency(totals.total)}
                    </dd>
                  </div>
                </dl>

                <Button size="lg" fullWidth className="mt-5" onClick={handleCheckout}>
                  Tiến hành thanh toán
                </Button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-text-muted">
                  Bạn sẽ được xác nhận lại đơn hàng qua điện thoại trước khi shop giao đi.
                </p>
              </div>
            </aside>
          </div>
        )}
      </Container>
    </>
  );
}

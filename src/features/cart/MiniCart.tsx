import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useCartStore, selectCartSubtotal } from '@/store/cartStore';
import { formatCurrency } from '@/utils/format';
import { Drawer, EmptyState, ButtonLink } from '@/components/ui';
import { FREE_SHIPPING_THRESHOLD } from '@/constants/routes';

export function MiniCart() {
  const isOpen = useCartStore((state) => state.isDrawerOpen);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartStore(selectCartSubtotal);

  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={closeDrawer}
      title={`Giỏ hàng (${items.length})`}
      footer={
        items.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Tạm tính</span>
              <span className="font-display text-lg font-extrabold text-gold">
                {formatCurrency(subtotal)}
              </span>
            </div>
            {remainingForFreeShip > 0 && (
              <p className="rounded-lg border border-gold/25 bg-gold/8 px-3 py-2 text-xs text-gold">
                Mua thêm {formatCurrency(remainingForFreeShip)} để được miễn phí vận chuyển.
              </p>
            )}
            <ButtonLink to={ROUTES.cart} fullWidth onClick={closeDrawer}>
              Xem giỏ hàng &amp; Thanh toán
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<ShoppingBag size={26} aria-hidden="true" />}
            title="Giỏ hàng đang trống"
            description="Thêm vài chiến binh Bakugan vào giỏ để bắt đầu trận đấu nhé!"
            action={
              <ButtonLink to={ROUTES.products} onClick={closeDrawer} variant="outline">
                Khám phá sản phẩm
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-white/6">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-3 p-4">
              <Link
                to={ROUTES.productDetail(item.slug)}
                onClick={closeDrawer}
                className="shrink-0"
                aria-label={item.name}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  width={72}
                  height={72}
                  className="h-18 w-18 rounded-xl bg-surface-2 object-cover"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  to={ROUTES.productDetail(item.slug)}
                  onClick={closeDrawer}
                  className="line-clamp-2 text-sm font-medium text-text transition hover:text-accent-cyan"
                >
                  {item.name}
                </Link>
                <p className="mt-1 font-display text-sm font-bold text-gold">
                  {formatCurrency(item.price)}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-lg border border-white/10 bg-surface-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      aria-label={`Giảm số lượng ${item.name}`}
                      className="p-1.5 text-text-muted transition hover:text-accent-cyan"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="min-w-7 text-center text-sm font-semibold text-text tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxQuantity}
                      aria-label={`Tăng số lượng ${item.name}`}
                      className="p-1.5 text-text-muted transition hover:text-accent-cyan disabled:opacity-35"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    aria-label={`Xoá ${item.name} khỏi giỏ`}
                    className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

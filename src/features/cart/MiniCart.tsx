import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD, ROUTES } from '@/constants/routes';
import { useCartStore, selectCartSubtotal } from '@/store/cartStore';
import { formatCurrency } from '@/utils/format';
import { Drawer, EmptyState, ButtonLink, RefImage } from '@/components/ui';

export function MiniCart() {
  const isOpen = useCartStore((state) => state.isDrawerOpen);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const items = useCartStore((state) => state.items);
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
                Thêm {formatCurrency(remainingForFreeShip)} nữa để được miễn phí vận chuyển.
              </p>
            )}
            <ButtonLink to={ROUTES.cart} fullWidth onClick={closeDrawer}>
              Xem giỏ hàng &amp; thanh toán
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
            description="Mở một feed và chọn những con bạn thích nhé — mỗi mã chỉ có một con!"
            action={
              <ButtonLink to={ROUTES.feeds} onClick={closeDrawer} variant="outline">
                Xem feed đang bán
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-white/6">
          {items.map((item) => {
            const link = ROUTES.itemDetail(item.code);
            return (
              <li key={item.itemId} className="flex gap-3 p-4">
                <Link to={link} onClick={closeDrawer} className="shrink-0" aria-label={item.name}>
                  <RefImage
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    width={72}
                    height={72}
                    className="h-18 w-18 rounded-xl bg-surface-2 object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-bold text-accent-cyan">{item.code}</p>
                  <Link
                    to={link}
                    onClick={closeDrawer}
                    className="line-clamp-2 text-sm font-medium text-text transition hover:text-accent-cyan"
                  >
                    {item.name}
                  </Link>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-bold text-gold">
                      {formatCurrency(item.price)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.itemId)}
                      aria-label={`Bỏ ${item.code} khỏi giỏ`}
                      className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}

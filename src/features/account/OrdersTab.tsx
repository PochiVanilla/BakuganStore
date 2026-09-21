import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { OrderStatus } from '@/types';
import { ROUTES } from '@/constants/routes';
import { ORDER_STATUS_LABELS } from '@/constants/catalog';
import { fetchMyOrders } from '@/services/api/authService';
import { useAsync } from '@/hooks/useAsync';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ButtonLink, EmptyState, Skeleton } from '@/components/ui';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'border-warning/45 bg-warning/12 text-warning',
  confirmed: 'border-accent-cyan/45 bg-accent-cyan/12 text-accent-cyan',
  shipping: 'border-primary/50 bg-primary/15 text-primary-soft',
  completed: 'border-success/45 bg-success/12 text-success',
  cancelled: 'border-white/15 bg-white/5 text-text-muted',
};

const PAYMENT_LABELS = {
  cod: 'Thanh toán khi nhận hàng',
  'bank-transfer': 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
} as const;

export function OrdersTab() {
  const { data, isLoading } = useAsync(() => fetchMyOrders(), []);
  const orders = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-text">Đơn hàng của tôi</h2>
      <p className="mt-1.5 text-sm text-text-muted">
        Toàn bộ lịch sử mua hàng của bạn tại TD Bakugan.
      </p>

      {orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Package size={26} aria-hidden="true" />}
            title="Bạn chưa có đơn hàng nào"
            description="Khi bạn đặt hàng, trạng thái và mã vận đơn sẽ hiện ở đây."
            action={<ButtonLink to={ROUTES.products}>Bắt đầu mua sắm</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-white/8 bg-surface/70 p-5">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3.5">
                <div>
                  <p className="font-display text-sm font-bold text-text">#{order.code}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Đặt lúc {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-lg border px-2.5 py-1 font-display text-[11px] font-bold tracking-wider',
                    STATUS_STYLES[order.status],
                  )}
                >
                  {ORDER_STATUS_LABELS[order.status].toUpperCase()}
                </span>
              </header>

              <ul className="divide-y divide-white/6 py-2">
                {order.items.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3 py-2.5">
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-lg bg-surface-2 object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-text">
                        {item.name}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatCurrency(item.price)} × {item.quantity}
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-sm font-bold text-gold">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <footer className="flex flex-wrap items-end justify-between gap-3 border-t border-white/8 pt-3.5">
                <div className="text-xs leading-relaxed text-text-muted">
                  <p>
                    Giao tới: <span className="text-text">{order.receiverName}</span> ·{' '}
                    {order.phone}
                  </p>
                  <p className="mt-0.5">{order.addressLine}</p>
                  <p className="mt-0.5">{PAYMENT_LABELS[order.paymentMethod]}</p>
                </div>
                <div className="text-right">
                  {order.discount > 0 && (
                    <p className="text-xs text-success">Đã giảm {formatCurrency(order.discount)}</p>
                  )}
                  <p className="text-xs text-text-muted">Tổng cộng</p>
                  <p className="font-display text-xl font-extrabold text-gold">
                    {formatCurrency(order.total)}
                  </p>
                </div>
              </footer>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-text-muted">
        Cần hỗ trợ về một đơn hàng?{' '}
        <Link to={ROUTES.contact} className="font-semibold text-accent-cyan hover:text-accent-pink">
          Liên hệ shop
        </Link>
      </p>
    </section>
  );
}

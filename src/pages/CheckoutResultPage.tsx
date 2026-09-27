import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleX, Clock, CreditCard, ShoppingCart, TriangleAlert } from 'lucide-react';
import type { Order, PaymentMethod } from '@/types';
import { ROUTES } from '@/constants/routes';
import { CANCEL_REASON_LABELS, PAYMENT_METHOD_LABELS } from '@/constants/orders';
import {
  DEFAULT_CHECKOUT_CONFIG,
  fetchCheckoutConfig,
  fetchShopBank,
} from '@/services/api/orderService';
import {
  cancelMyUnpaidOrder,
  fetchMyOrder,
  startCardPayment,
  switchPaymentMethod,
} from '@/services/api/paymentService';
import { fetchItemsByIds } from '@/services/api/feedService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useCountdown } from '@/hooks/useCountdown';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatUsd } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  Button,
  ButtonLink,
  Container,
  EmptyState,
  Modal,
  RefImage,
  Seo,
  Skeleton,
} from '@/components/ui';
import { CheckoutSteps } from '@/features/checkout/CheckoutSteps';
import { OrderReceipt } from '@/features/checkout/OrderReceipt';
import { goToGateway } from '@/features/checkout/gateway';

type OfflineMethod = Exclude<PaymentMethod, 'card'>;
const OFFLINE_METHODS: readonly OfflineMethod[] = ['cod', 'bank-transfer', 'momo'];

function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="mt-4 divide-y divide-white/8 rounded-2xl border border-white/8 text-left">
      {order.items.map((item) => (
        <li key={item.itemId} className="flex items-center gap-3 px-4 py-2.5">
          <RefImage
            src={item.image}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-sm text-text">
            {item.code && <span className="font-mono text-xs text-accent-cyan">{item.code}</span>}{' '}
            {item.name}
          </span>
          <span className="shrink-0 text-sm font-semibold text-gold">
            {formatCurrency(item.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Đơn trả thẻ chưa trả xong: trả lại, đổi cách trả (đơn trong nước) hoặc huỷ. */
function AwaitingCardPayment({
  order,
  usdRate,
  onExpired,
}: {
  order: Order;
  usdRate: number;
  onExpired: () => void;
}) {
  const navigate = useNavigate();
  const holdEnds = order.cardPayment?.expiresAt ?? order.createdAt;
  const { minutes, seconds, isFinished } = useCountdown(holdEnds);
  const [busy, setBusy] = useState<'pay' | 'switch' | 'cancel' | null>(null);
  const [switchTo, setSwitchTo] = useState<OfflineMethod>('cod');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const international = order.shippingRegion === 'international';
  const lastError = order.cardPayment?.lastError;

  // Hết giờ giữ hàng -> hỏi lại server (đơn sẽ được huỷ, hàng mở bán lại). Đồng hồ đếm theo
  // giây nên hỏi thêm một lần ngay sau đó cho chắc.
  useEffect(() => {
    if (!isFinished) return;
    onExpired();
    const timer = window.setTimeout(onExpired, 1_500);
    return () => window.clearTimeout(timer);
  }, [isFinished, onExpired]);

  const pay = async (): Promise<void> => {
    setBusy('pay');
    try {
      const { redirectUrl } = await startCardPayment(order.id);
      goToGateway(redirectUrl, navigate);
    } catch (error) {
      toast.error('Chưa mở được trang thanh toán', getApiErrorMessage(error));
      setBusy(null);
    }
  };

  const switchMethod = async (): Promise<void> => {
    setBusy('switch');
    try {
      await switchPaymentMethod(order.id, switchTo);
      toast.success('Đã đổi cách thanh toán', PAYMENT_METHOD_LABELS[switchTo]);
    } catch (error) {
      toast.error('Chưa đổi được', getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (): Promise<void> => {
    setBusy('cancel');
    try {
      await cancelMyUnpaidOrder(order.id);
      setConfirmCancel(false);
      toast.info('Đã huỷ đơn', 'Các con Bakugan đã được mở bán lại.');
    } catch (error) {
      toast.error('Chưa huỷ được', getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-warning/30 bg-surface/80 p-6 sm:p-10">
      <div className="text-center">
        {lastError ? (
          <TriangleAlert size={44} className="mx-auto text-warning" aria-hidden="true" />
        ) : (
          <CreditCard size={44} className="mx-auto text-accent-cyan" aria-hidden="true" />
        )}
        <h1 className="mt-4 font-display text-2xl font-black text-text">
          {lastError ? 'Thanh toán chưa thành công' : 'Đơn đang chờ thanh toán'}
        </h1>
        {international && (
          <p className="mt-1 text-sm text-text-muted" lang="en">
            {lastError ? 'Your payment did not go through.' : 'Your order is awaiting payment.'}
          </p>
        )}
        <p className="mt-3 text-sm text-text-muted">
          Đơn <span className="font-mono font-bold text-gold">#{order.code}</span> —{' '}
          <span className="font-semibold text-text">{formatCurrency(order.total)}</span>
          {international && <> (≈&nbsp;{formatUsd(order.total, usdRate)})</>}
        </p>
        {lastError && (
          <p
            role="alert"
            className="mx-auto mt-4 max-w-md rounded-xl border border-warning/35 bg-warning/8 p-3 text-sm text-warning"
          >
            {lastError}
          </p>
        )}
        <p
          className={cn(
            'mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums',
            isFinished ? 'border-danger/40 text-danger' : 'border-accent-cyan/40 text-accent-cyan',
          )}
          role="timer"
        >
          <Clock size={15} aria-hidden="true" />
          {isFinished ? (
            'Đã hết thời gian giữ hàng'
          ) : (
            <span>
              Giữ hàng <span className="hidden sm:inline">cho bạn </span>thêm{' '}
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          )}
        </p>
      </div>

      <OrderLines order={order} />

      <div className="mt-6 flex flex-col gap-3">
        <Button
          size="lg"
          fullWidth
          isLoading={busy === 'pay'}
          disabled={isFinished || (busy !== null && busy !== 'pay')}
          leftIcon={<CreditCard size={18} />}
          onClick={() => void pay()}
        >
          {lastError ? 'Thử lại với thẻ khác' : 'Thanh toán bằng thẻ'}
        </Button>

        {!international && (
          <div className="rounded-2xl border border-white/8 p-4">
            <p className="text-sm font-semibold text-text">Hoặc đổi sang cách khác</p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Cách thanh toán khác"
            >
              {OFFLINE_METHODS.map((method) => (
                <label
                  key={method}
                  className={cn(
                    'cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-cyan',
                    switchTo === method
                      ? 'border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan'
                      : 'border-white/10 text-text-muted hover:border-white/25',
                  )}
                >
                  <input
                    type="radio"
                    name="switch-method"
                    value={method}
                    checked={switchTo === method}
                    onChange={() => setSwitchTo(method)}
                    className="sr-only"
                  />
                  {PAYMENT_METHOD_LABELS[method]}
                </label>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              isLoading={busy === 'switch'}
              disabled={isFinished || (busy !== null && busy !== 'switch')}
              onClick={() => void switchMethod()}
            >
              Dùng {PAYMENT_METHOD_LABELS[switchTo].toLowerCase()}
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          disabled={busy !== null}
          className="self-center text-sm font-semibold text-text-muted underline-offset-2 transition hover:text-danger hover:underline disabled:opacity-50"
        >
          Huỷ đơn này
        </button>
      </div>

      <Modal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={`Huỷ đơn #${order.code}?`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Không huỷ
            </Button>
            <Button variant="danger" isLoading={busy === 'cancel'} onClick={() => void cancel()}>
              Huỷ đơn
            </Button>
          </div>
        }
      >
        Các con Bakugan trong đơn sẽ được mở bán lại cho người khác. Bạn chưa bị trừ tiền.
      </Modal>
    </div>
  );
}

/** Đơn đã huỷ (quá hạn trả thẻ / khách huỷ): cho thêm lại vào giỏ những con vẫn còn. */
function CancelledOrder({ order }: { order: Order }) {
  const addItem = useCartStore((state) => state.addItem);
  const cartIds = useCartStore((state) => state.items.map((item) => item.itemId).join(','));
  const ids = order.items.flatMap((item) => (item.code ? [item.itemId] : []));
  const live = useAsync(() => fetchItemsByIds(ids), [ids.join(',')], {
    enabled: ids.length > 0,
  });
  const stillAvailable = (live.data ?? []).filter(
    (item) => item.status === 'available' && !cartIds.split(',').includes(item.id),
  );

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-surface/80 p-6 text-center sm:p-10">
      <CircleX size={44} className="mx-auto text-text-muted" aria-hidden="true" />
      <h1 className="mt-4 font-display text-2xl font-black text-text">Đơn đã huỷ</h1>
      <p className="mt-3 text-sm text-text-muted">
        Đơn <span className="font-mono font-bold text-gold">#{order.code}</span>
        {order.cancelReason && <> — {CANCEL_REASON_LABELS[order.cancelReason].toLowerCase()}</>}.
        {order.cancelReason === 'payment-timeout' &&
          ' Chưa thanh toán trong thời gian giữ hàng nên các con Bakugan đã được mở bán lại.'}{' '}
        Bạn không bị trừ tiền.
      </p>
      <OrderLines order={order} />
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {stillAvailable.length > 0 && (
          <Button
            leftIcon={<ShoppingCart size={17} />}
            onClick={() => {
              stillAvailable.forEach((item) => addItem(item));
              toast.success(`Đã thêm lại ${stillAvailable.length} con vào giỏ`);
            }}
          >
            Thêm lại {stillAvailable.length} con còn bán vào giỏ
          </Button>
        )}
        <ButtonLink to={ROUTES.cart} variant="secondary">
          Về giỏ hàng
        </ButtonLink>
        <ButtonLink to={ROUTES.feeds} variant="ghost">
          Xem feed khác
        </ButtonLink>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const revision = useLiveRevision();
  const {
    data: order,
    error,
    isLoading,
    reload,
  } = useAsync(() => fetchMyOrder(orderId), [orderId, revision], { keepPreviousData: true });
  const config = useAsync(() => fetchCheckoutConfig(), []);
  const usdRate = (config.data ?? DEFAULT_CHECKOUT_CONFIG).international.usdRate;
  const needsBank = order?.paymentMethod === 'bank-transfer';
  const bank = useAsync(() => fetchShopBank(), [needsBank], { enabled: needsBank });

  const done = order && order.status !== 'cancelled' && order.paymentMethod !== 'card';
  const paid = order?.paymentMethod === 'card' && order.paymentStatus === 'paid';

  return (
    <>
      <Seo
        title={order ? `Đơn #${order.code}` : 'Kết quả thanh toán'}
        description="Kết quả đặt hàng và thanh toán tại TD Bakugan."
        noIndex
      />
      <Container className="py-8 sm:py-12">
        <CheckoutSteps current={done || paid ? 2 : 1} />
        {isLoading && !order ? (
          <Skeleton className="mx-auto h-96 max-w-2xl rounded-3xl" />
        ) : error || !order ? (
          <EmptyState
            title="Không tìm thấy đơn hàng"
            description={error ?? 'Đơn này không thuộc tài khoản của bạn.'}
            action={
              <ButtonLink to={`${ROUTES.account}?tab=orders`}>Xem đơn hàng của tôi</ButtonLink>
            }
          />
        ) : order.status === 'cancelled' ? (
          <CancelledOrder order={order} />
        ) : order.paymentMethod === 'card' && order.paymentStatus === 'unpaid' ? (
          <AwaitingCardPayment order={order} usdRate={usdRate} onExpired={reload} />
        ) : (
          <OrderReceipt order={order} bank={bank.data ?? null} usdRate={usdRate} />
        )}
      </Container>
    </>
  );
}

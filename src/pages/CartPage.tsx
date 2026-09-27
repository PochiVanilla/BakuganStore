import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  Landmark,
  PackageCheck,
  ShoppingBag,
  Tag,
  Trash2,
  TriangleAlert,
  Truck,
  X,
} from 'lucide-react';
import type { Order, PaymentMethod, ShopBankInfo } from '@/types';
import { FREE_SHIPPING_THRESHOLD, ROUTES, SHOP_INFO } from '@/constants/routes';
import { CONDITION_LABELS } from '@/constants/catalog';
import { PAYMENT_METHOD_LABELS } from '@/constants/orders';
import {
  applyCoupon,
  calculateTotals,
  fetchShopBank,
  placeOrder,
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

const PAYMENT_OPTIONS: ReadonlyArray<{ value: PaymentMethod; hint: string }> = [
  { value: 'cod', hint: 'Trả tiền mặt khi nhận hàng, được đồng kiểm với shipper.' },
  { value: 'bank-transfer', hint: 'Shop gửi thông tin chuyển khoản sau khi đặt.' },
  { value: 'momo', hint: 'Nhân viên gửi mã MoMo khi gọi xác nhận.' },
];

const NEW_ADDRESS = 'new';

function BankInstructions({ order, bank }: { order: Order; bank: ShopBankInfo | null }) {
  if (order.paymentMethod !== 'bank-transfer') return null;
  return (
    <div className="mt-5 rounded-2xl border border-accent-cyan/30 bg-accent-cyan/8 p-4 text-sm">
      <p className="inline-flex items-center gap-2 font-semibold text-accent-cyan">
        <Landmark size={16} aria-hidden="true" />
        Chuyển khoản {formatCurrency(order.total)}
      </p>
      {bank ? (
        <dl className="mt-3 grid gap-1.5 text-text-muted">
          <div>
            Ngân hàng: <span className="font-semibold text-text">{bank.bankName}</span>
          </div>
          <div>
            Số tài khoản:{' '}
            <span className="font-mono font-semibold text-text">{bank.accountNumber}</span>
          </div>
          <div>
            Chủ tài khoản: <span className="font-semibold text-text">{bank.accountHolder}</span>
          </div>
          <div>
            Nội dung: <span className="font-mono font-semibold text-gold">{order.code}</span>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-text-muted">
          Nhân viên sẽ gửi số tài khoản khi gọi xác nhận đơn, hoặc bạn nhắn Zalo {SHOP_INFO.hotline}{' '}
          kèm mã đơn <span className="font-mono text-gold">{order.code}</span>.
        </p>
      )}
      <p className="mt-3 text-xs text-text-muted">
        Quá 24 giờ chưa nhận được tiền thì đơn tự huỷ và các con Bakugan được mở bán lại.
      </p>
    </div>
  );
}

function OrderPlaced({ order }: { order: Order }) {
  const bank = useAsync(() => fetchShopBank(), [order.id]);
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-success/30 bg-surface/80 p-6 text-center sm:p-10">
      <CheckCircle2 size={44} className="mx-auto text-success" aria-hidden="true" />
      <h2 className="mt-4 font-display text-2xl font-black text-text">Đặt hàng thành công!</h2>
      <p className="mt-2 text-sm text-text-muted">
        Mã đơn <span className="font-mono font-bold text-gold">#{order.code}</span> — tổng{' '}
        <span className="font-semibold text-text">{formatCurrency(order.total)}</span>.{' '}
        {order.items.length} con Bakugan đã được giữ cho bạn (hiện SOLD trên feed).
      </p>
      <ul className="mt-5 divide-y divide-white/8 rounded-2xl border border-white/8 text-left">
        {order.items.map((item) => (
          <li key={item.itemId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0 truncate text-sm text-text">
              <span className="font-mono text-xs text-accent-cyan">{item.code}</span> {item.name}
            </span>
            <span className="shrink-0 text-sm font-semibold text-gold">
              {formatCurrency(item.price)}
            </span>
          </li>
        ))}
      </ul>
      <BankInstructions order={order} bank={bank.data ?? null} />
      <p className="mt-5 inline-flex items-start gap-2 text-left text-sm text-text-muted">
        <PackageCheck size={16} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
        Shop sẽ gọi xác nhận trong giờ làm việc, sau đó đóng gói chống sốc và gửi đi. Bạn theo dõi
        đơn ở mục Đơn hàng của tôi.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink to={`${ROUTES.account}?tab=orders`}>Xem đơn hàng của tôi</ButtonLink>
        <ButtonLink to={ROUTES.feeds} variant="secondary">
          Xem feed khác
        </ButtonLink>
      </div>
    </div>
  );
}

export default function CartPage() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const coupon = useCartStore((state) => state.coupon);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const removeItem = useCartStore((state) => state.removeItem);
  const removeMany = useCartStore((state) => state.removeMany);
  const clear = useCartStore((state) => state.clear);
  const revision = useLiveRevision();

  const [couponCode, setCouponCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  const defaultAddress = user?.addresses.find((address) => address.isDefault) ?? user?.addresses[0];
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? NEW_ADDRESS);
  const [receiverName, setReceiverName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [addressLine, setAddressLine] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [note, setNote] = useState('');

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

  const totals = calculateTotals(buyable, coupon);
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

  const handlePlaceOrder = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!user) return;
    const saved = user.addresses.find((address) => address.id === addressId);
    const receiver = saved
      ? {
          receiverName: saved.receiverName,
          phone: saved.phone,
          addressLine: `${saved.street}, ${saved.ward}, ${saved.district}, ${saved.province}`,
        }
      : { receiverName, phone, addressLine };
    if (!receiver.receiverName.trim() || !/^0\d{9,10}$/.test(receiver.phone.replace(/\s/g, ''))) {
      toast.error(
        'Kiểm tra lại người nhận',
        'Cần họ tên và số điện thoại 10–11 số bắt đầu bằng 0.',
      );
      return;
    }
    if (receiver.addressLine.trim().length < 10) {
      toast.error('Địa chỉ chưa đủ', 'Ghi rõ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.');
      return;
    }
    setIsPlacing(true);
    try {
      const order = await placeOrder({
        itemIds: buyable.map((item) => item.itemId),
        ...receiver,
        paymentMethod,
        couponCode: coupon?.code,
        note,
      });
      removeMany(order.items.map((item) => item.itemId));
      setCoupon(null);
      setPlaced(order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('Đặt hàng thành công', `Mã đơn #${order.code}`);
    } catch (error) {
      toast.error('Chưa đặt được đơn', getApiErrorMessage(error));
      live.reload();
    } finally {
      setIsPlacing(false);
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
        {placed ? (
          <OrderPlaced order={placed} />
        ) : (
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
                      {notOpenYet.map((item) => item.code).join(', ')} thuộc feed chưa tới giờ mở
                      bán — tới giờ bạn quay lại chốt nhé.
                    </p>
                  )}
                  {remainingForFreeShip > 0 && buyable.length > 0 && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-text-muted">
                      <Truck size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                      <span>
                        Thêm{' '}
                        <strong className="text-gold">
                          {formatCurrency(remainingForFreeShip)}
                        </strong>{' '}
                        nữa để được miễn phí vận chuyển toàn quốc.
                      </span>
                    </div>
                  )}

                  <ul className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-surface/70">
                    {items.map((item) => {
                      const isGone = unavailable.includes(item);
                      const link = item.feedNumber
                        ? ROUTES.feedDetail(item.feedNumber, item.code)
                        : ROUTES.feeds;
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
                    <h2 className="font-display text-base font-bold text-text">Chốt đơn</h2>

                    {!user ? (
                      <div className="mt-4">
                        <p className="text-sm text-text-muted">
                          Đăng nhập để đặt hàng và theo dõi đơn. Mỗi con Bakugan chỉ có một, ai chốt
                          trước được trước!
                        </p>
                        <ButtonLink
                          to={ROUTES.login}
                          state={{ from: location }}
                          fullWidth
                          className="mt-4"
                        >
                          Đăng nhập để chốt đơn
                        </ButtonLink>
                      </div>
                    ) : (
                      <form onSubmit={handlePlaceOrder} className="mt-4 space-y-5">
                        <fieldset>
                          <legend className="mb-2 text-sm font-semibold text-text">Giao tới</legend>
                          <div className="space-y-2">
                            {user.addresses.map((address) => (
                              <label
                                key={address.id}
                                className={cn(
                                  'flex cursor-pointer gap-2.5 rounded-xl border p-3 text-sm transition',
                                  addressId === address.id
                                    ? 'border-accent-cyan/60 bg-accent-cyan/8'
                                    : 'border-white/10 hover:border-white/25',
                                )}
                              >
                                <input
                                  type="radio"
                                  name="address"
                                  value={address.id}
                                  checked={addressId === address.id}
                                  onChange={() => setAddressId(address.id)}
                                  className="mt-1 accent-[var(--color-accent-cyan)]"
                                />
                                <span className="min-w-0">
                                  <span className="block font-semibold text-text">
                                    {address.receiverName} · {address.phone}
                                  </span>
                                  <span className="block text-xs text-text-muted">
                                    {address.street}, {address.ward}, {address.district},{' '}
                                    {address.province}
                                  </span>
                                </span>
                              </label>
                            ))}
                            <label
                              className={cn(
                                'flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm transition',
                                addressId === NEW_ADDRESS
                                  ? 'border-accent-cyan/60 bg-accent-cyan/8'
                                  : 'border-white/10 hover:border-white/25',
                              )}
                            >
                              <input
                                type="radio"
                                name="address"
                                value={NEW_ADDRESS}
                                checked={addressId === NEW_ADDRESS}
                                onChange={() => setAddressId(NEW_ADDRESS)}
                                className="accent-[var(--color-accent-cyan)]"
                              />
                              <span className="text-text">
                                {user.addresses.length > 0 ? 'Địa chỉ khác' : 'Nhập địa chỉ nhận'}
                              </span>
                            </label>
                          </div>
                          {addressId === NEW_ADDRESS && (
                            <div className="mt-3 space-y-2.5">
                              <input
                                value={receiverName}
                                onChange={(event) => setReceiverName(event.target.value)}
                                placeholder="Họ tên người nhận"
                                aria-label="Họ tên người nhận"
                                autoComplete="name"
                                className="h-11 w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 text-sm text-text outline-none focus:border-accent-cyan"
                              />
                              <input
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                placeholder="Số điện thoại"
                                aria-label="Số điện thoại"
                                inputMode="tel"
                                autoComplete="tel"
                                className="h-11 w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 text-sm text-text outline-none focus:border-accent-cyan"
                              />
                              <textarea
                                value={addressLine}
                                onChange={(event) => setAddressLine(event.target.value)}
                                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                                aria-label="Địa chỉ nhận hàng"
                                rows={2}
                                autoComplete="street-address"
                                className="w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm text-text outline-none focus:border-accent-cyan"
                              />
                            </div>
                          )}
                        </fieldset>

                        <fieldset>
                          <legend className="mb-2 text-sm font-semibold text-text">
                            Thanh toán
                          </legend>
                          <div className="space-y-2">
                            {PAYMENT_OPTIONS.map((option) => (
                              <label
                                key={option.value}
                                className={cn(
                                  'flex cursor-pointer gap-2.5 rounded-xl border p-3 text-sm transition',
                                  paymentMethod === option.value
                                    ? 'border-accent-cyan/60 bg-accent-cyan/8'
                                    : 'border-white/10 hover:border-white/25',
                                )}
                              >
                                <input
                                  type="radio"
                                  name="payment"
                                  value={option.value}
                                  checked={paymentMethod === option.value}
                                  onChange={() => setPaymentMethod(option.value)}
                                  className="mt-1 accent-[var(--color-accent-cyan)]"
                                />
                                <span>
                                  <span className="block font-semibold text-text">
                                    {PAYMENT_METHOD_LABELS[option.value]}
                                  </span>
                                  <span className="block text-xs text-text-muted">
                                    {option.hint}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <label className="block">
                          <span className="mb-1.5 block text-sm font-semibold text-text">
                            Ghi chú cho shop
                          </span>
                          <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="VD: gọi trước khi giao, giao giờ hành chính…"
                            className="w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm text-text outline-none focus:border-accent-cyan"
                          />
                        </label>

                        <Button
                          type="submit"
                          size="lg"
                          fullWidth
                          isLoading={isPlacing}
                          disabled={buyable.length === 0}
                        >
                          Đặt hàng · {formatCurrency(totals.total)}
                        </Button>
                      </form>
                    )}

                    {/* Mã giảm giá */}
                    <form
                      onSubmit={handleApplyCoupon}
                      className="mt-5 border-t border-white/8 pt-4"
                    >
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
                        <dt className="text-text-muted">Tạm tính ({buyable.length} con)</dt>
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
                    <p className="mt-3 text-center text-[11px] leading-relaxed text-text-muted">
                      Shop gọi xác nhận trước khi giao. Đơn chưa xác nhận bạn có thể nhờ trợ lý AI
                      huỷ giúp.
                    </p>
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </Container>
    </>
  );
}

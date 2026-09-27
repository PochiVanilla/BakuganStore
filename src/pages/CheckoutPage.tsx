import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, House, LoaderCircle, LockKeyhole, TriangleAlert } from 'lucide-react';
import type { InternationalAddress, PaymentMethod, ShippingRegion } from '@/types';
import { ROUTES } from '@/constants/routes';
import { DELIVERY_ESTIMATE } from '@/constants/shipping';
import {
  calculateTotals,
  couponAppliesTo,
  DEFAULT_CHECKOUT_CONFIG,
  fetchCheckoutConfig,
  placeOrder,
  type CheckoutInput,
  type ShippingDestination,
} from '@/services/api/orderService';
import { startCardPayment } from '@/services/api/paymentService';
import { fetchItemsByIds } from '@/services/api/feedService';
import { fetchMyOrders } from '@/services/api/authService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { toast, useUIStore } from '@/store/uiStore';
import { EMPTY_INTL_ADDRESS, validateIntlAddress } from '@/utils/intlAddress';
import { compactPhone, isForeignPhone, isValidPhone, isVietnamPhone } from '@/utils/phone';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, ButtonLink, Container, EmptyState, Input, Seo, Textarea } from '@/components/ui';
import { CheckoutSteps } from '@/features/checkout/CheckoutSteps';
import {
  InternationalAddressFields,
  type IntlContactErrors,
} from '@/features/checkout/InternationalAddressFields';
import { OrderSummary } from '@/features/checkout/OrderSummary';
import { PaymentOptions } from '@/features/checkout/PaymentOptions';
import { ShippingMethod } from '@/features/checkout/ShippingMethod';
import { goToGateway } from '@/features/checkout/gateway';

const NEW_ADDRESS = 'new';

function omitKeys<T extends object>(value: T, keys: ReadonlyArray<PropertyKey>): T {
  if (!keys.some((key) => key in value)) return value;
  const next = { ...value };
  for (const key of keys) delete next[key as keyof T];
  return next;
}

interface IntlDraft {
  address: InternationalAddress;
  receiverName: string;
  phone: string;
}

type DomesticErrors = Partial<Record<'receiverName' | 'phone' | 'addressLine', string>>;

function Section({
  step,
  id,
  title,
  children,
}: {
  step: number;
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-white/8 bg-surface/70 p-5 sm:p-6"
    >
      <h2
        id={id}
        className="mb-4 flex items-center gap-2.5 font-display text-base font-bold text-text"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-accent-cyan/50 bg-accent-cyan/10 text-xs text-accent-cyan">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const REGION_OPTIONS: ReadonlyArray<{
  value: ShippingRegion;
  icon: typeof House;
  title: string;
  hint: string;
}> = [
  {
    value: 'domestic',
    icon: House,
    title: 'Trong Việt Nam',
    hint: `${DELIVERY_ESTIMATE.domestic} · COD, chuyển khoản, MoMo, thẻ`,
  },
  {
    value: 'international',
    icon: Globe,
    title: 'Nước ngoài · International',
    hint: `${DELIVERY_ESTIMATE.international} · trả bằng thẻ Visa / Mastercard / JCB`,
  },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user)!;
  const items = useCartStore((state) => state.items);
  const coupon = useCartStore((state) => state.coupon);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const removeMany = useCartStore((state) => state.removeMany);
  const revision = useLiveRevision();

  const configQuery = useAsync(() => fetchCheckoutConfig(), [revision], { keepPreviousData: true });
  const config = configQuery.data ?? DEFAULT_CHECKOUT_CONFIG;
  const intlAvailable = config.cardPayments && config.international.enabled;

  // Khách từng gửi ra nước ngoài thì điền sẵn địa chỉ lần trước.
  const myOrders = useAsync(() => fetchMyOrders(user.id), [user.id]);
  const lastIntlOrder = myOrders.data?.find((order) => order.intlAddress);

  const [region, setRegion] = useState<ShippingRegion>(() =>
    isForeignPhone(user.phone) ? 'international' : 'domestic',
  );
  const effectiveRegion: ShippingRegion =
    region === 'international' && intlAvailable ? 'international' : 'domestic';
  const international = effectiveRegion === 'international';

  // Giao trong nước
  const defaultAddress = user.addresses.find((address) => address.isDefault) ?? user.addresses[0];
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? NEW_ADDRESS);
  const [receiverName, setReceiverName] = useState(user.fullName);
  const [phone, setPhone] = useState(isVietnamPhone(user.phone) ? user.phone : '');
  const [addressLine, setAddressLine] = useState('');
  const [domesticErrors, setDomesticErrors] = useState<DomesticErrors>({});

  // Gửi ra nước ngoài — chưa sửa gì thì dùng bản điền sẵn.
  const [intlDraft, setIntlDraft] = useState<IntlDraft | null>(null);
  const intlForm: IntlDraft = intlDraft ?? {
    address: lastIntlOrder?.intlAddress
      ? { ...EMPTY_INTL_ADDRESS, ...lastIntlOrder.intlAddress }
      : EMPTY_INTL_ADDRESS,
    receiverName: lastIntlOrder?.receiverName ?? user.fullName,
    phone: lastIntlOrder?.phone ?? (isForeignPhone(user.phone) ? user.phone : ''),
  };
  const [intlErrors, setIntlErrors] = useState<IntlContactErrors>({});
  const patchIntl = (patch: Partial<IntlDraft>): void => setIntlDraft({ ...intlForm, ...patch });
  // Sửa ô nào thì bỏ báo lỗi ô đó; đổi nước thì yêu cầu mã bưu chính cũng đổi theo.
  const clearIntlErrors = (...keys: Array<keyof IntlContactErrors>): void =>
    setIntlErrors((current) => omitKeys(current, keys));
  const clearDomesticError = (key: keyof DomesticErrors): void =>
    setDomesticErrors((current) => omitKeys(current, [key]));

  const [method, setMethod] = useState<PaymentMethod>('cod');
  const paymentMethod: PaymentMethod = international
    ? 'card'
    : method === 'card' && !config.cardPayments
      ? 'cod'
      : method;
  const [note, setNote] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const formErrorToast = useRef<string | null>(null);

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

  const destination: ShippingDestination = {
    region: effectiveRegion,
    countryCode: international ? intlForm.address.countryCode || undefined : undefined,
  };
  const couponApplies = !coupon || couponAppliesTo(coupon, destination);
  const totals = calculateTotals(buyable, couponApplies ? coupon : null, destination, config);
  const shippingKnown = !international || Boolean(destination.countryCode);

  const chooseRegion = (next: ShippingRegion): void => {
    setRegion(next);
    setDomesticErrors({});
    setIntlErrors({});
  };

  const focusFirstError = (): void => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const buildInput = (): CheckoutInput | null => {
    const common = {
      itemIds: buyable.map((item) => item.itemId),
      paymentMethod,
      couponCode: couponApplies ? coupon?.code : undefined,
      note,
    };
    if (international) {
      const problems: IntlContactErrors = validateIntlAddress(intlForm.address);
      if (intlForm.receiverName.trim().length < 2)
        problems.receiverName = 'Nhập họ tên người nhận.';
      if (!compactPhone(intlForm.phone).startsWith('+') || !isValidPhone(intlForm.phone)) {
        problems.phone = 'Ghi số kèm mã nước, VD +1 415 555 0123.';
      }
      setIntlErrors(problems);
      if (Object.keys(problems).length > 0) return null;
      return {
        ...common,
        receiverName: intlForm.receiverName,
        phone: intlForm.phone,
        addressLine: '',
        shippingRegion: 'international',
        intlAddress: intlForm.address,
      };
    }
    const saved = user.addresses.find((address) => address.id === addressId);
    if (saved) {
      return {
        ...common,
        receiverName: saved.receiverName,
        phone: saved.phone,
        addressLine: `${saved.street}, ${saved.ward}, ${saved.district}, ${saved.province}`,
        shippingRegion: 'domestic',
      };
    }
    const problems: DomesticErrors = {};
    if (receiverName.trim().length < 2) problems.receiverName = 'Nhập họ tên người nhận.';
    if (!isVietnamPhone(phone)) problems.phone = 'Số di động Việt Nam, VD 0912345678.';
    if (addressLine.trim().length < 10) {
      problems.addressLine = 'Ghi rõ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.';
    }
    setDomesticErrors(problems);
    if (Object.keys(problems).length > 0) return null;
    return { ...common, receiverName, phone, addressLine, shippingRegion: 'domestic' };
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (buyable.length === 0 || isPlacing) return;
    const input = buildInput();
    if (!input) {
      formErrorToast.current = toast.error(
        'Kiểm tra lại thông tin nhận hàng',
        'Các ô đánh dấu đỏ còn thiếu hoặc chưa đúng.',
      );
      focusFirstError();
      return;
    }
    // Đã sửa xong thì tắt thông báo lỗi cũ, kẻo nó còn hiện cạnh trang thanh toán / kết quả.
    if (formErrorToast.current) {
      useUIStore.getState().dismissToast(formErrorToast.current);
      formErrorToast.current = null;
    }
    setIsPlacing(true);
    try {
      const order = await placeOrder(input);
      if (order.paymentMethod === 'card') setRedirecting(true);
      removeMany(order.items.map((item) => item.itemId));
      if (input.couponCode) setCoupon(null);
      if (order.paymentMethod !== 'card') {
        toast.success('Đặt hàng thành công', `Mã đơn #${order.code}`);
        navigate(ROUTES.checkoutResult(order.id), { replace: true });
        return;
      }
      try {
        const { redirectUrl } = await startCardPayment(order.id);
        goToGateway(redirectUrl, navigate);
      } catch (error) {
        toast.error('Chưa mở được trang thanh toán thẻ', getApiErrorMessage(error));
        navigate(ROUTES.checkoutResult(order.id), { replace: true });
      }
    } catch (error) {
      toast.error('Chưa đặt được đơn', getApiErrorMessage(error));
      live.reload();
    } finally {
      setIsPlacing(false);
    }
  };

  if (redirecting) {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16 text-center">
        <LoaderCircle size={32} className="animate-spin text-accent-cyan" aria-hidden="true" />
        <p className="font-display text-lg font-bold text-text">Đang mở trang thanh toán thẻ…</p>
        <p className="text-sm text-text-muted">Các con Bakugan trong đơn đã được giữ cho bạn.</p>
      </Container>
    );
  }

  return (
    <>
      <Seo
        title="Thanh toán"
        description="Nhập địa chỉ nhận hàng, chọn cách thanh toán và chốt đơn."
        path={ROUTES.checkout}
        noIndex
      />
      <Container className="py-8 sm:py-12">
        <CheckoutSteps current={1} />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">Thanh toán</h1>
          <Link
            to={ROUTES.cart}
            className="text-sm font-semibold text-text-muted transition hover:text-accent-cyan"
          >
            ← Quay lại giỏ hàng
          </Link>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Giỏ hàng đang trống"
            description="Chọn vài con Bakugan trong các feed rồi quay lại thanh toán nhé."
            action={<ButtonLink to={ROUTES.feeds}>Xem feed đang bán</ButtonLink>}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <form
              id="checkout-form"
              onSubmit={(event) => void handleSubmit(event)}
              noValidate
              className="min-w-0 space-y-5"
            >
              {(unavailable.length > 0 || notOpenYet.length > 0) && (
                <div
                  role="alert"
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-danger/35 bg-danger/10 p-4 text-sm text-danger"
                >
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {unavailable.length > 0 &&
                      `${unavailable.map((item) => item.code).join(', ')} vừa có người chốt trước (SOLD). `}
                    {notOpenYet.length > 0 &&
                      `${notOpenYet.map((item) => item.code).join(', ')} thuộc feed chưa tới giờ mở bán. `}
                    Những con này không nằm trong đơn.
                  </span>
                  {unavailable.length > 0 && (
                    <button
                      type="button"
                      onClick={() => removeMany(unavailable.map((item) => item.itemId))}
                      className="font-semibold underline underline-offset-2"
                    >
                      Bỏ khỏi giỏ
                    </button>
                  )}
                </div>
              )}

              <Section step={1} id="checkout-address" title="Giao hàng tới">
                <div
                  className="grid gap-2.5 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Giao tới đâu"
                >
                  {REGION_OPTIONS.map((option) => {
                    const disabled = option.value === 'international' && !intlAvailable;
                    const checked = effectiveRegion === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-cyan',
                          checked
                            ? 'border-accent-cyan/60 bg-accent-cyan/8'
                            : 'border-white/10 hover:border-white/25',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <input
                          type="radio"
                          name="shipping-region"
                          value={option.value}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => chooseRegion(option.value)}
                          className="sr-only"
                        />
                        <option.icon
                          size={20}
                          className={cn(
                            'mt-0.5 shrink-0',
                            checked ? 'text-accent-cyan' : 'text-text-muted',
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-text">
                            {option.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-text-muted">
                            {disabled ? 'Shop đang tạm ngưng gửi ra nước ngoài' : option.hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-5">
                  {international ? (
                    <InternationalAddressFields
                      address={intlForm.address}
                      onAddress={(patch) => {
                        patchIntl({ address: { ...intlForm.address, ...patch } });
                        const keys = Object.keys(patch) as Array<keyof InternationalAddress>;
                        clearIntlErrors(
                          ...keys,
                          ...(patch.countryCode ? (['postalCode'] as const) : []),
                        );
                      }}
                      receiverName={intlForm.receiverName}
                      onReceiverName={(value) => {
                        patchIntl({ receiverName: value });
                        clearIntlErrors('receiverName');
                      }}
                      phone={intlForm.phone}
                      onPhone={(value) => {
                        patchIntl({ phone: value });
                        clearIntlErrors('phone');
                      }}
                      errors={intlErrors}
                    />
                  ) : (
                    <div className="space-y-2.5">
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
                              {address.label} · {address.receiverName} · {address.phone}
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
                          {user.addresses.length > 0
                            ? 'Giao tới địa chỉ khác'
                            : 'Nhập địa chỉ nhận'}
                        </span>
                      </label>
                      {addressId === NEW_ADDRESS && (
                        <div className="grid gap-4 pt-2 sm:grid-cols-2">
                          <Input
                            label="Họ tên người nhận"
                            name="receiver-name"
                            autoComplete="shipping name"
                            required
                            value={receiverName}
                            onChange={(event) => {
                              setReceiverName(event.target.value);
                              clearDomesticError('receiverName');
                            }}
                            error={domesticErrors.receiverName}
                          />
                          <Input
                            label="Số điện thoại"
                            name="receiver-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="shipping tel"
                            placeholder="0912345678"
                            required
                            value={phone}
                            onChange={(event) => {
                              setPhone(event.target.value);
                              clearDomesticError('phone');
                            }}
                            error={domesticErrors.phone}
                          />
                          <div className="sm:col-span-2">
                            <Textarea
                              label="Địa chỉ nhận hàng"
                              name="receiver-address"
                              autoComplete="shipping street-address"
                              rows={2}
                              required
                              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                              value={addressLine}
                              onChange={(event) => {
                                setAddressLine(event.target.value);
                                clearDomesticError('addressLine');
                              }}
                              error={domesticErrors.addressLine}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Section>

              <Section step={2} id="checkout-shipping" title="Vận chuyển">
                <ShippingMethod
                  region={effectiveRegion}
                  countryCode={destination.countryCode}
                  fee={totals.shippingFee}
                  freeShippingThreshold={config.freeShippingThreshold}
                />
              </Section>

              <Section step={3} id="checkout-payment" title="Thanh toán">
                <PaymentOptions
                  region={effectiveRegion}
                  value={paymentMethod}
                  onChange={setMethod}
                  cardEnabled={config.cardPayments}
                  total={totals.total}
                  usdRate={config.international.usdRate}
                  holdMinutes={config.cardHoldMinutes}
                />
              </Section>

              <Section step={4} id="checkout-note" title="Ghi chú cho shop">
                <Textarea
                  label="Ghi chú (không bắt buộc)"
                  name="order-note"
                  rows={2}
                  maxLength={500}
                  placeholder={
                    international
                      ? 'VD: giờ nhận hàng, mã cổng… · Delivery notes'
                      : 'VD: gọi trước khi giao, giao giờ hành chính…'
                  }
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Section>
            </form>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <OrderSummary
                lines={buyable.map((item) => ({
                  key: item.itemId,
                  code: item.code,
                  name: item.name,
                  price: item.price,
                  image: item.image,
                }))}
                totals={totals}
                region={effectiveRegion}
                shippingKnown={shippingKnown}
                usdRate={config.international.usdRate}
                coupon={coupon}
                couponApplies={couponApplies}
                onRemoveCoupon={() => setCoupon(null)}
              >
                <Button
                  type="submit"
                  form="checkout-form"
                  size="lg"
                  fullWidth
                  className="mt-5 px-4 sm:px-7"
                  isLoading={isPlacing}
                  disabled={buyable.length === 0}
                  leftIcon={paymentMethod === 'card' ? <LockKeyhole size={17} /> : undefined}
                >
                  {/* Một span cho cả nhãn để chữ và số tiền nằm chung một dòng. */}
                  <span>
                    {paymentMethod !== 'card'
                      ? 'Đặt hàng'
                      : shippingKnown
                        ? 'Thanh toán'
                        : 'Thanh toán bằng thẻ'}
                    {shippingKnown && (
                      <span className="whitespace-nowrap">
                        {paymentMethod === 'card' ? ' ' : ' · '}
                        {formatCurrency(totals.total)}
                      </span>
                    )}
                  </span>
                </Button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-text-muted">
                  {paymentMethod === 'card'
                    ? `Bạn sẽ nhập thẻ trên trang bảo mật của cổng thanh toán. Hàng được giữ ${config.cardHoldMinutes} phút.`
                    : 'Shop gọi xác nhận trước khi giao. Đơn chưa xác nhận bạn có thể nhờ trợ lý AI huỷ giúp.'}
                </p>
              </OrderSummary>
            </aside>
          </div>
        )}
      </Container>
    </>
  );
}

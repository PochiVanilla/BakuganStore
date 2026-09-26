import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Gavel, Minus, Plus, Search, Trash2, UserRound } from 'lucide-react';
import type { AdminCustomer, Address, Product } from '@/types';
import { PAYMENT_METHODS } from '@/types';
import { ADMIN_ROUTES, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';
import { PAYMENT_METHOD_LABELS } from '@/constants/orders';
import {
  createOrder,
  listAdminAuctions,
  listCustomers,
  listProductOptions,
} from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLatestRef } from '@/hooks/useLatestRef';
import { toast } from '@/store/uiStore';
import { formatCurrency } from '@/utils/format';
import { normalizeSearch } from '@/utils/slugify';
import { cn } from '@/utils/cn';
import { Button, Input, Seo, Skeleton, Textarea } from '@/components/ui';
import { AdminPageHeader, ErrorBox, Panel } from '@/features/admin/adminUi';
import { createOrderSchema, type CreateOrderFormValues } from '@/features/admin/schemas';

function formatAddress(address: Address): string {
  return `${address.street}, ${address.ward}, ${address.district}, ${address.province}`;
}

const numberInput =
  'h-10 w-full rounded-lg border border-white/10 bg-surface-2/80 px-2.5 text-right text-sm text-text tabular-nums outline-none focus:border-accent-cyan';

function RadioCard({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
}) {
  return (
    <label
      className={cn(
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition',
        checked
          ? 'border-accent-cyan/50 bg-accent-cyan/8'
          : 'border-white/10 hover:border-white/20',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-[#3FE3F5]"
      />
      <span>
        <span className="block text-sm font-medium text-text">{title}</span>
        {description && <span className="block text-xs text-text-muted">{description}</span>}
      </span>
    </label>
  );
}

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auctionParam = params.get('auction') ?? '';
  const customerParam = params.get('customer') ?? '';

  const customers = useAsync(
    () => listCustomers({ role: 'customer', status: 'active', sort: 'name' }),
    [],
  );
  const products = useAsync(() => listProductOptions(), []);
  const auctions = useAsync(() => listAdminAuctions(), [auctionParam], {
    enabled: Boolean(auctionParam),
  });
  const auctionRow = auctions.data?.find((row) => row.auction.id === auctionParam);
  const auctionReady = auctionRow?.fulfillment === 'awaiting-order';

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerMode: 'account',
      customerId: '',
      customerEmail: '',
      receiverName: '',
      phone: '',
      addressLine: '',
      items: [],
      auctionId: '',
      shippingFee: SHIPPING_FEE,
      discount: 0,
      paymentMethod: 'bank-transfer',
      paymentStatus: 'unpaid',
      initialStatus: 'confirmed',
      note: '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watched = useWatch({ control });

  /* ---- Chọn khách ---- */
  const [customerQuery, setCustomerQuery] = useState('');
  const selectedCustomer = customers.data?.find((item) => item.id === watched.customerId);
  const customerMatches = useMemo(() => {
    const needle = normalizeSearch(customerQuery);
    return (customers.data ?? [])
      .filter((item) =>
        needle
          ? normalizeSearch(`${item.fullName} ${item.email} ${item.phone}`).includes(needle)
          : true,
      )
      .slice(0, 6);
  }, [customers.data, customerQuery]);

  const applyAddress = (customer: AdminCustomer, address?: Address): void => {
    const chosen =
      address ?? customer.addresses.find((item) => item.isDefault) ?? customer.addresses[0];
    setValue('receiverName', chosen?.receiverName ?? customer.fullName, { shouldValidate: true });
    setValue('phone', chosen?.phone ?? customer.phone, { shouldValidate: true });
    setValue('addressLine', chosen ? formatAddress(chosen) : '', {
      shouldValidate: Boolean(chosen),
    });
  };

  const selectCustomer = (customer: AdminCustomer): void => {
    setValue('customerId', customer.id, { shouldValidate: true });
    setValue('customerEmail', customer.email);
    applyAddress(customer);
    setCustomerQuery('');
  };

  /* ---- Đơn từ phiên đấu giá: điền sẵn người thắng (chạy một lần khi dữ liệu về) ---- */
  const selectCustomerRef = useLatestRef(selectCustomer);
  useEffect(() => {
    if (!auctionReady || !auctionRow || !customers.data) return;
    if (getValues('auctionId') === auctionRow.auction.id) return;
    setValue('auctionId', auctionRow.auction.id);
    setValue('shippingFee', 0);
    setValue('note', `Đơn cho người thắng phiên "${auctionRow.auction.title}".`);
    const winner = customers.data.find((item) => item.id === auctionRow.winner?.id);
    if (winner) selectCustomerRef.current(winner);
  }, [auctionReady, auctionRow, customers.data, getValues, setValue, selectCustomerRef]);

  /* ---- Mở từ hồ sơ khách: chọn sẵn khách đó ---- */
  useEffect(() => {
    if (!customerParam || !customers.data || getValues('customerId')) return;
    const customer = customers.data.find((item) => item.id === customerParam);
    if (customer) selectCustomerRef.current(customer);
  }, [customerParam, customers.data, getValues, selectCustomerRef]);

  /* ---- Sản phẩm ---- */
  const [productQuery, setProductQuery] = useState('');
  const productById = useMemo(
    () => new Map((products.data ?? []).map((product) => [product.id, product])),
    [products.data],
  );
  const productMatches = useMemo(() => {
    const needle = normalizeSearch(productQuery);
    if (!needle) return [];
    return (products.data ?? [])
      .filter((product) => normalizeSearch(product.name).includes(needle))
      .slice(0, 6);
  }, [products.data, productQuery]);

  const addProduct = (product: Product): void => {
    const index = getValues('items').findIndex((item) => item.productId === product.id);
    if (index >= 0) {
      const current = getValues(`items.${index}.quantity`);
      setValue(`items.${index}.quantity`, Math.min(product.stock, current + 1), {
        shouldValidate: true,
      });
    } else {
      append({ productId: product.id, quantity: 1, price: product.price });
    }
    setProductQuery('');
  };

  /* ---- Tổng tiền ---- */
  const items = watched.items ?? [];
  const auctionPrice = watched.auctionId && auctionRow ? auctionRow.auction.currentPrice : 0;
  const subtotal =
    auctionPrice +
    items.reduce(
      (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
      0,
    );
  const shippingFee = Number(watched.shippingFee) || 0;
  const discount = Number(watched.discount) || 0;
  const total = Math.max(0, subtotal + shippingFee - discount);
  const stockProblems = items.filter((item) => {
    const product = item?.productId ? productById.get(item.productId) : undefined;
    return product ? (Number(item?.quantity) || 0) > product.stock : false;
  }).length;

  const onSubmit = async (values: CreateOrderFormValues): Promise<void> => {
    try {
      const order = await createOrder({
        customerId: values.customerMode === 'account' ? values.customerId : undefined,
        customerEmail: values.customerEmail || undefined,
        receiverName: values.receiverName,
        phone: values.phone,
        addressLine: values.addressLine,
        items: values.items,
        auctionId: values.auctionId || undefined,
        shippingFee: values.shippingFee,
        discount: values.discount,
        paymentMethod: values.paymentMethod,
        paymentStatus: values.paymentStatus,
        initialStatus: values.initialStatus,
        note: values.note,
      });
      toast.success(`Đã tạo đơn #${order.code}`, formatCurrency(order.total));
      navigate(ADMIN_ROUTES.orderDetail(order.id));
    } catch (error) {
      toast.error('Không tạo được đơn', getApiErrorMessage(error));
    }
  };

  const loading = customers.isLoading || products.isLoading || (auctionParam && auctions.isLoading);
  const loadError = customers.error ?? products.error ?? auctions.error;

  return (
    <>
      <Seo
        title="Tạo đơn hàng"
        description="Admin tạo đơn thủ công"
        path={ADMIN_ROUTES.createOrder}
        noIndex
      />
      <Link
        to={ADMIN_ROUTES.orders}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Danh sách đơn
      </Link>
      <AdminPageHeader
        title={auctionParam ? 'Tạo đơn cho người thắng đấu giá' : 'Tạo đơn hàng'}
        description="Dùng cho đơn chốt qua Zalo, Messenger, tại cửa hàng hoặc đơn đấu giá. Tồn kho được trừ ngay khi tạo."
      />

      {loadError && <ErrorBox message={loadError} />}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[520px] xl:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            {auctionParam && !auctionReady && (
              <ErrorBox message="Phiên này chưa kết thúc, không có người thắng hoặc đã được tạo đơn." />
            )}

            {/* ---------- Khách hàng ---------- */}
            <Panel title="1. Khách hàng">
              <div className="flex flex-col gap-2 sm:flex-row">
                <RadioCard
                  name="customer-mode"
                  checked={watched.customerMode === 'account'}
                  onChange={() => setValue('customerMode', 'account')}
                  title="Khách có tài khoản"
                  description="Đơn hiện trong mục “Đơn hàng của tôi” của khách."
                />
                <RadioCard
                  name="customer-mode"
                  checked={watched.customerMode === 'guest'}
                  onChange={() => {
                    setValue('customerMode', 'guest');
                    setValue('customerId', '');
                  }}
                  title="Khách lẻ"
                  description="Mua tại quầy hoặc chưa đăng ký tài khoản."
                />
              </div>

              {watched.customerMode === 'account' && (
                <div className="mt-4">
                  {selectedCustomer ? (
                    <div className="rounded-xl border border-white/10 bg-surface-2/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-semibold text-text">
                          <UserRound size={16} className="text-accent-cyan" aria-hidden="true" />
                          {selectedCustomer.fullName}
                          <span className="font-normal text-text-muted">
                            · {selectedCustomer.email}
                          </span>
                        </p>
                        {!watched.auctionId && (
                          <button
                            type="button"
                            className="text-xs font-medium text-accent-cyan hover:underline"
                            onClick={() => setValue('customerId', '')}
                          >
                            Đổi khách
                          </button>
                        )}
                      </div>
                      {selectedCustomer.addresses.length > 1 && (
                        <fieldset className="mt-3">
                          <legend className="mb-1.5 text-xs text-text-muted">Giao tới</legend>
                          <div className="flex flex-col gap-1.5">
                            {selectedCustomer.addresses.map((address) => (
                              <label
                                key={address.id}
                                className="flex cursor-pointer items-start gap-2 text-sm text-text-muted"
                              >
                                <input
                                  type="radio"
                                  name="customer-address"
                                  defaultChecked={address.isDefault}
                                  onChange={() => applyAddress(selectedCustomer, address)}
                                  className="mt-1 accent-[#3FE3F5]"
                                />
                                <span>
                                  <span className="font-medium text-text">{address.label}:</span>{' '}
                                  {formatAddress(address)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                    </div>
                  ) : (
                    <>
                      <label className="relative block">
                        <span className="sr-only">Tìm khách hàng</span>
                        <Search
                          size={16}
                          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={customerQuery}
                          onChange={(event) => setCustomerQuery(event.target.value)}
                          placeholder="Tìm theo tên, email hoặc số điện thoại"
                          className="h-11 w-full rounded-xl border border-white/10 bg-surface-2/80 pr-3 pl-9 text-sm text-text outline-none focus:border-accent-cyan"
                        />
                      </label>
                      <ul className="mt-2 divide-y divide-white/5 rounded-xl border border-white/8">
                        {customerMatches.map((customer) => (
                          <li key={customer.id}>
                            <button
                              type="button"
                              onClick={() => selectCustomer(customer)}
                              className="flex w-full flex-wrap items-center gap-x-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                            >
                              <span className="text-sm font-medium text-text">
                                {customer.fullName}
                              </span>
                              <span className="text-xs text-text-muted">
                                {customer.email} · {customer.phone || 'chưa có SĐT'}
                              </span>
                            </button>
                          </li>
                        ))}
                        {customerMatches.length === 0 && (
                          <li className="px-3 py-3 text-sm text-text-muted">
                            Không tìm thấy khách phù hợp.
                          </li>
                        )}
                      </ul>
                      {errors.customerId && (
                        <p role="alert" className="mt-2 text-sm text-danger">
                          {errors.customerId.message}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Người nhận"
                  required
                  error={errors.receiverName?.message}
                  {...register('receiverName')}
                />
                <Input
                  label="Số điện thoại"
                  type="tel"
                  inputMode="numeric"
                  required
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <Input
                  label="Email (tuỳ chọn)"
                  type="email"
                  containerClassName="sm:col-span-2"
                  error={errors.customerEmail?.message}
                  {...register('customerEmail')}
                />
                <Input
                  label="Địa chỉ giao hàng"
                  required
                  containerClassName="sm:col-span-2"
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  error={errors.addressLine?.message}
                  {...register('addressLine')}
                />
              </div>
            </Panel>

            {/* ---------- Sản phẩm ---------- */}
            <Panel
              title="2. Sản phẩm"
              description="Có thể sửa đơn giá khi chốt giá riêng với khách."
            >
              {watched.auctionId && auctionRow && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
                  <img
                    src={auctionRow.auction.images[0]}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                      <Gavel size={13} aria-hidden="true" /> Món thắng đấu giá
                    </p>
                    <p className="truncate text-sm font-medium text-text">
                      {auctionRow.auction.title}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-text tabular-nums">
                    {formatCurrency(auctionRow.auction.currentPrice)}
                  </p>
                </div>
              )}

              <label className="relative block">
                <span className="sr-only">Tìm sản phẩm để thêm</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder={
                    watched.auctionId
                      ? 'Thêm món khác vào cùng đơn (tuỳ chọn)'
                      : 'Gõ tên sản phẩm để thêm vào đơn'
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-surface-2/80 pr-3 pl-9 text-sm text-text outline-none focus:border-accent-cyan"
                />
              </label>
              {productMatches.length > 0 && (
                <ul className="mt-2 divide-y divide-white/5 rounded-xl border border-white/8">
                  {productMatches.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        disabled={product.stock === 0}
                        onClick={() => addProduct(product)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <img
                          src={product.images[0]}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-text">
                          {product.name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {product.stock === 0 ? 'Hết hàng' : `Còn ${product.stock}`}
                        </span>
                        <span className="w-24 text-right text-sm font-semibold text-text tabular-nums">
                          {formatCurrency(product.price)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {fields.length > 0 && (
                <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/8">
                  {fields.map((field, index) => {
                    const product = productById.get(field.productId);
                    const quantity = Number(items[index]?.quantity) || 0;
                    const overStock = product ? quantity > product.stock : false;
                    return (
                      <li key={field.id} className="flex flex-wrap items-center gap-3 p-3">
                        <img
                          src={product?.images[0]}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate text-sm font-medium text-text">{product?.name}</p>
                          <p
                            className={cn('text-xs', overStock ? 'text-danger' : 'text-text-muted')}
                          >
                            {overStock
                              ? `Chỉ còn ${product?.stock} trong kho`
                              : `Tồn kho: ${product?.stock ?? 0}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Giảm số lượng"
                            className="rounded-lg p-2 text-text-muted hover:bg-white/5"
                            onClick={() =>
                              setValue(`items.${index}.quantity`, Math.max(1, quantity - 1))
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <label>
                            <span className="sr-only">Số lượng {product?.name}</span>
                            <input
                              type="number"
                              min={1}
                              className={cn(numberInput, 'w-14', overStock && 'border-danger/70')}
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label="Tăng số lượng"
                            className="rounded-lg p-2 text-text-muted hover:bg-white/5"
                            onClick={() => setValue(`items.${index}.quantity`, quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <label className="w-32">
                          <span className="sr-only">Đơn giá {product?.name}</span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            className={numberInput}
                            {...register(`items.${index}.price`, { valueAsNumber: true })}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          aria-label={`Bỏ ${product?.name ?? 'sản phẩm'} khỏi đơn`}
                          className="rounded-lg p-2 text-text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.items?.message && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {errors.items.message}
                </p>
              )}
            </Panel>

            {/* ---------- Thanh toán ---------- */}
            <Panel title="3. Thanh toán & ghi chú">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
                  Hình thức thanh toán
                  <select
                    className="h-12 rounded-xl border border-white/10 bg-surface-2/80 px-3 font-normal text-text"
                    {...register('paymentMethod')}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium text-text">Tình trạng tiền</legend>
                  <div className="flex gap-2">
                    <RadioCard
                      name="payment-status"
                      checked={watched.paymentStatus === 'unpaid'}
                      onChange={() => setValue('paymentStatus', 'unpaid')}
                      title="Chưa trả"
                    />
                    <RadioCard
                      name="payment-status"
                      checked={watched.paymentStatus === 'paid'}
                      onChange={() => setValue('paymentStatus', 'paid')}
                      title="Đã trả"
                    />
                  </div>
                </fieldset>
                <Input
                  label="Phí vận chuyển (₫)"
                  type="number"
                  min={0}
                  step={1000}
                  hint={`Chính sách: ${formatCurrency(SHIPPING_FEE)}, miễn phí từ ${formatCurrency(FREE_SHIPPING_THRESHOLD)}.`}
                  error={errors.shippingFee?.message}
                  {...register('shippingFee', { valueAsNumber: true })}
                />
                <Input
                  label="Giảm giá (₫)"
                  type="number"
                  min={0}
                  step={1000}
                  error={errors.discount?.message}
                  {...register('discount', { valueAsNumber: true })}
                />
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium text-text">
                    Trạng thái khi tạo
                  </legend>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <RadioCard
                      name="initial-status"
                      checked={watched.initialStatus === 'confirmed'}
                      onChange={() => setValue('initialStatus', 'confirmed')}
                      title="Đã xác nhận"
                      description="Đã chốt với khách, chuyển sang đóng gói được ngay."
                    />
                    <RadioCard
                      name="initial-status"
                      checked={watched.initialStatus === 'pending'}
                      onChange={() => setValue('initialStatus', 'pending')}
                      title="Chờ xác nhận"
                      description="Cần gọi lại khách trước khi xử lý."
                    />
                  </div>
                </fieldset>
                <Textarea
                  label="Ghi chú đơn"
                  rows={2}
                  className="min-h-20"
                  error={errors.note?.message}
                  {...register('note')}
                />
              </div>
            </Panel>
          </div>

          {/* ---------- Tóm tắt ---------- */}
          <aside className="xl:sticky xl:top-20 xl:self-start">
            <Panel title="Tóm tắt đơn">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-text-muted">
                  <dt>Tạm tính</dt>
                  <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-text-muted">
                  <dt>Phí vận chuyển</dt>
                  <dd className="tabular-nums">{formatCurrency(shippingFee)}</dd>
                </div>
                <div className="flex justify-between text-text-muted">
                  <dt>Giảm giá</dt>
                  <dd className="tabular-nums">−{formatCurrency(discount)}</dd>
                </div>
                <div className="flex justify-between border-t border-white/8 pt-3 text-lg font-bold text-text">
                  <dt>Tổng cộng</dt>
                  <dd className="tabular-nums">{formatCurrency(total)}</dd>
                </div>
              </dl>
              {subtotal >= FREE_SHIPPING_THRESHOLD && shippingFee > 0 && (
                <button
                  type="button"
                  onClick={() => setValue('shippingFee', 0)}
                  className="mt-3 text-xs font-medium text-accent-cyan hover:underline"
                >
                  Đơn đủ điều kiện miễn phí ship — áp dụng
                </button>
              )}
              {stockProblems > 0 && (
                <p role="alert" className="mt-3 text-xs text-danger">
                  Có {stockProblems} dòng vượt quá tồn kho.
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                size="lg"
                className="mt-5"
                isLoading={isSubmitting}
                disabled={stockProblems > 0 || (Boolean(auctionParam) && !auctionReady)}
              >
                Tạo đơn
              </Button>
            </Panel>
          </aside>
        </form>
      )}
    </>
  );
}

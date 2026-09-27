import { CheckCircle2, Globe, Landmark, PackageCheck } from 'lucide-react';
import type { Order, ShopBankInfo } from '@/types';
import { ROUTES, SHOP_INFO } from '@/constants/routes';
import { DELIVERY_ESTIMATE } from '@/constants/shipping';
import { describeCard, PAYMENT_METHOD_LABELS } from '@/constants/orders';
import { countryName } from '@/constants/countries';
import { formatCurrency, formatDateTime, formatUsd } from '@/utils/format';
import { ButtonLink, RefImage } from '@/components/ui';

function BankInstructions({ order, bank }: { order: Order; bank: ShopBankInfo | null }) {
  return (
    <div className="mt-5 rounded-2xl border border-accent-cyan/30 bg-accent-cyan/8 p-4 text-left text-sm">
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

/** Màn hình sau khi đặt thành công (hoặc trả thẻ thành công). */
export function OrderReceipt({
  order,
  bank,
  usdRate,
}: {
  order: Order;
  bank: ShopBankInfo | null;
  usdRate: number;
}) {
  const international = order.shippingRegion === 'international';
  const paidByCard = order.paymentMethod === 'card' && order.paymentStatus === 'paid';

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-success/30 bg-surface/80 p-6 text-center sm:p-10">
      <CheckCircle2 size={44} className="mx-auto text-success" aria-hidden="true" />
      <h1 className="mt-4 font-display text-2xl font-black text-text">
        {paidByCard ? 'Thanh toán thành công!' : 'Đặt hàng thành công!'}
      </h1>
      {international && paidByCard && (
        <p className="mt-1 text-sm text-text-muted" lang="en">
          Payment received — thank you for your order!
        </p>
      )}
      <p className="mt-3 text-sm text-text-muted">
        Mã đơn <span className="font-mono font-bold text-gold">#{order.code}</span> — tổng{' '}
        <span className="font-semibold text-text">{formatCurrency(order.total)}</span>
        {international && <> (≈&nbsp;{formatUsd(order.total, usdRate)})</>}. {order.items.length}{' '}
        con Bakugan đã được giữ cho bạn (hiện SOLD trên feed).
      </p>

      <dl className="mt-5 grid gap-2 rounded-2xl border border-white/8 p-4 text-left text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-text-muted">Thanh toán</dt>
          <dd className="mt-0.5 font-semibold text-text">
            {order.paymentMethod === 'card'
              ? describeCard(order.cardPayment)
              : PAYMENT_METHOD_LABELS[order.paymentMethod]}
          </dd>
          {paidByCard && order.cardPayment?.transactionId && (
            <dd className="text-xs text-text-muted">
              Mã giao dịch <span className="font-mono">{order.cardPayment.transactionId}</span>
              {order.cardPayment.paidAt && ` · ${formatDateTime(order.cardPayment.paidAt)}`}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-text-muted">Giao tới</dt>
          <dd className="mt-0.5 font-semibold text-text">
            {order.receiverName} · {order.phone}
          </dd>
          <dd className="text-xs text-text-muted">{order.addressLine}</dd>
          {international && order.intlAddress && (
            <dd className="mt-1 inline-flex items-center gap-1 text-xs text-accent-cyan">
              <Globe size={12} aria-hidden="true" />
              Gửi quốc tế tới {countryName(order.intlAddress.countryCode)}
            </dd>
          )}
        </div>
      </dl>

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

      {order.paymentMethod === 'bank-transfer' && <BankInstructions order={order} bank={bank} />}

      <p className="mt-5 inline-flex items-start gap-2 text-left text-sm text-text-muted">
        <PackageCheck size={16} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
        {international
          ? `Shop kiểm hàng, đóng gói chống sốc và gửi chuyển phát quốc tế trong 1–2 ngày làm việc, kèm mã theo dõi. Thời gian nhận dự kiến ${DELIVERY_ESTIMATE.international}.`
          : 'Shop sẽ gọi xác nhận trong giờ làm việc, sau đó đóng gói chống sốc và gửi đi. Bạn theo dõi đơn ở mục Đơn hàng của tôi.'}
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

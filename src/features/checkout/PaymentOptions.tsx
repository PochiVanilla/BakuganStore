import { Banknote, CreditCard, Landmark, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PaymentMethod, ShippingRegion } from '@/types';
import { PAYMENT_METHOD_LABELS } from '@/constants/orders';
import { formatCurrency, formatUsd } from '@/utils/format';
import { cn } from '@/utils/cn';
import { CardBrandMarks } from './CardBrandMarks';

const DOMESTIC_OPTIONS: ReadonlyArray<{ value: PaymentMethod; icon: LucideIcon; hint: string }> = [
  { value: 'cod', icon: Banknote, hint: 'Trả tiền mặt khi nhận hàng, được đồng kiểm với shipper.' },
  {
    value: 'bank-transfer',
    icon: Landmark,
    hint: 'Shop gửi thông tin chuyển khoản ngay sau khi đặt.',
  },
  { value: 'momo', icon: Smartphone, hint: 'Nhân viên gửi mã MoMo khi gọi xác nhận.' },
];

function OptionRow({
  checked,
  onSelect,
  icon: Icon,
  title,
  hint,
  extra,
  value,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  hint: string;
  extra?: React.ReactNode;
  value: PaymentMethod;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border p-3.5 text-sm transition',
        checked
          ? 'border-accent-cyan/60 bg-accent-cyan/8'
          : 'border-white/10 hover:border-white/25',
      )}
    >
      <input
        type="radio"
        name="payment-method"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-[var(--color-accent-cyan)]"
      />
      <Icon size={18} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-text">
          <span>{title}</span>
          {extra}
        </span>
        <span className="mt-0.5 block text-xs text-text-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Chọn cách thanh toán. Đơn gửi ra nước ngoài chỉ trả bằng thẻ. */
export function PaymentOptions({
  region,
  value,
  onChange,
  cardEnabled,
  total,
  usdRate,
  holdMinutes,
}: {
  region: ShippingRegion;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  cardEnabled: boolean;
  total: number;
  usdRate: number;
  holdMinutes: number;
}) {
  const international = region === 'international';

  return (
    <div className="space-y-2.5">
      {!international &&
        DOMESTIC_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            value={option.value}
            checked={value === option.value}
            onSelect={() => onChange(option.value)}
            icon={option.icon}
            title={PAYMENT_METHOD_LABELS[option.value]}
            hint={option.hint}
          />
        ))}

      {cardEnabled ? (
        <OptionRow
          value="card"
          checked={value === 'card'}
          onSelect={() => onChange('card')}
          icon={CreditCard}
          title={international ? 'Thẻ quốc tế · Credit / debit card' : 'Thẻ quốc tế'}
          extra={<CardBrandMarks />}
          hint={
            international
              ? 'Thẻ phát hành ở nước nào cũng được · Cards issued in any country are accepted.'
              : 'Thẻ tín dụng / ghi nợ Visa, Mastercard, JCB — trả ngay, không cần chờ shop gọi.'
          }
        />
      ) : (
        <p className="rounded-xl border border-white/10 p-3.5 text-xs text-text-muted">
          Shop đang tạm ngưng nhận thanh toán thẻ.
        </p>
      )}

      {international && (
        <p className="text-xs text-text-muted">
          Đơn gửi ra nước ngoài chỉ thanh toán bằng thẻ · International orders are paid by card.
        </p>
      )}

      {value === 'card' && cardEnabled && (
        <div className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/6 p-4 text-xs leading-relaxed text-text-muted">
          <p className="flex items-start gap-2">
            <LockKeyhole
              size={15}
              className="mt-0.5 shrink-0 text-accent-cyan"
              aria-hidden="true"
            />
            <span>
              Bấm thanh toán, bạn được chuyển sang{' '}
              <strong className="text-text">trang bảo mật của cổng thanh toán</strong> để nhập thẻ
              và xác thực 3-D Secure (OTP ngân hàng gửi). TD Bakugan không nhìn thấy và không lưu số
              thẻ của bạn.
            </span>
          </p>
          <p className="mt-2 flex items-start gap-2">
            <ShieldCheck
              size={15}
              className="mt-0.5 shrink-0 text-accent-cyan"
              aria-hidden="true"
            />
            <span>
              Thẻ bị trừ <strong className="text-text">{formatCurrency(total)}</strong>
              {international && <> (≈&nbsp;{formatUsd(total, usdRate)})</>} bằng tiền đồng Việt Nam;
              ngân hàng của bạn tự quy đổi và có thể thu phí giao dịch nước ngoài. Shop giữ các con
              Bakugan trong đơn cho bạn {holdMinutes} phút để thanh toán.
            </span>
          </p>
          {international && (
            <p className="mt-2 border-t border-white/8 pt-2 text-[11px]" lang="en">
              You will enter your card on the payment gateway&apos;s secure page (3-D Secure). The
              charge is in Vietnamese dong (≈&nbsp;{formatUsd(total, usdRate)}); your bank converts
              it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

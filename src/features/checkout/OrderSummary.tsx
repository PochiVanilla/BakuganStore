import type { ReactNode } from 'react';
import { Tag, X } from 'lucide-react';
import type { Coupon, ShippingRegion } from '@/types';
import type { CartTotals } from '@/services/api/orderService';
import { formatCurrency, formatUsd } from '@/utils/format';
import { RefImage } from '@/components/ui';

export interface SummaryLine {
  key: string;
  code?: string;
  name: string;
  price: number;
  image: string;
}

/** Tóm tắt đơn bên phải trang thanh toán: từng con, mã giảm giá, tổng tiền. */
export function OrderSummary({
  lines,
  totals,
  region,
  shippingKnown,
  usdRate,
  coupon,
  couponApplies,
  onRemoveCoupon,
  children,
}: {
  lines: SummaryLine[];
  totals: CartTotals;
  region: ShippingRegion;
  /** Gửi ra nước ngoài mà chưa chọn nước thì chưa biết phí gửi */
  shippingKnown: boolean;
  usdRate: number;
  coupon: Coupon | null;
  couponApplies: boolean;
  onRemoveCoupon?: () => void;
  children?: ReactNode;
}) {
  const total = shippingKnown ? totals.total : Math.max(0, totals.subtotal - totals.discount);

  return (
    <div className="rounded-2xl border border-white/8 bg-surface/80 p-5">
      <h2 className="font-display text-base font-bold text-text">
        Đơn hàng{' '}
        <span className="font-sans text-sm font-normal text-text-muted">({lines.length} con)</span>
      </h2>
      <ul className="mt-3 max-h-72 divide-y divide-white/6 overflow-y-auto pr-1">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center gap-3 py-2.5">
            <RefImage
              src={line.image}
              alt=""
              loading="lazy"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1">
              {line.code && (
                <span className="block font-mono text-[11px] font-bold text-accent-cyan">
                  {line.code}
                </span>
              )}
              <span className="line-clamp-1 text-sm text-text">{line.name}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-gold">
              {formatCurrency(line.price)}
            </span>
          </li>
        ))}
      </ul>

      {coupon && (
        <div
          className={
            couponApplies
              ? 'mt-3 flex items-start gap-2 rounded-lg border border-success/35 bg-success/10 p-2.5 text-xs text-success'
              : 'mt-3 flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/10 p-2.5 text-xs text-warning'
          }
        >
          <Tag size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <strong>{coupon.code}</strong> — {coupon.label}
            {!couponApplies && (
              <span className="block">
                Chỉ dùng cho đơn giao trong Việt Nam, đơn này không áp dụng.
              </span>
            )}
          </span>
          {onRemoveCoupon && (
            <button
              type="button"
              onClick={onRemoveCoupon}
              aria-label="Gỡ mã giảm giá"
              className="shrink-0 transition hover:text-text"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      <dl className="mt-4 space-y-2.5 border-t border-white/8 pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Tạm tính</dt>
          <dd className="font-medium text-text">{formatCurrency(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">
            {region === 'international' ? 'Phí gửi quốc tế' : 'Phí vận chuyển'}
          </dt>
          <dd className="text-right font-medium text-text">
            {!shippingKnown ? (
              <span className="text-text-muted">Chọn nước để tính</span>
            ) : totals.shippingFee === 0 ? (
              <span className="text-success">Miễn phí</span>
            ) : (
              formatCurrency(totals.shippingFee)
            )}
          </dd>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Giảm giá</dt>
            <dd className="font-medium text-success">−{formatCurrency(totals.discount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/8 pt-3">
          <dt className="font-display font-bold text-text">
            {shippingKnown ? 'Tổng cộng' : 'Tổng (chưa gồm phí gửi)'}
          </dt>
          <dd className="text-right">
            <span className="block font-display text-2xl font-extrabold text-gold neon-text-gold">
              {formatCurrency(total)}
            </span>
            {region === 'international' && (
              <span className="text-xs text-text-muted">≈&nbsp;{formatUsd(total, usdRate)}</span>
            )}
          </dd>
        </div>
      </dl>
      {children}
    </div>
  );
}

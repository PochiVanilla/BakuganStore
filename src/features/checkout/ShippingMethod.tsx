import { Globe, PackageCheck, Truck } from 'lucide-react';
import type { ShippingRegion } from '@/types';
import { DELIVERY_ESTIMATE, ZONE_LABELS } from '@/constants/shipping';
import { zoneOf } from '@/constants/countries';
import { formatCurrency } from '@/utils/format';

/** Cách giao duy nhất cho mỗi vùng: phí, thời gian, lưu ý. */
export function ShippingMethod({
  region,
  countryCode,
  fee,
  freeShippingThreshold,
}: {
  region: ShippingRegion;
  countryCode?: string;
  fee: number;
  freeShippingThreshold: number;
}) {
  if (region === 'international') {
    return (
      <div className="rounded-xl border border-white/10 bg-surface-2/40 p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2.5 font-semibold text-text">
            <Globe size={18} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
            <span>
              Chuyển phát quốc tế có mã theo dõi
              <span className="block text-xs font-normal text-text-muted" lang="en">
                International tracked shipping · {DELIVERY_ESTIMATE.international}
              </span>
            </span>
          </p>
          <span className="shrink-0 text-right font-display font-bold text-gold">
            {countryCode ? formatCurrency(fee) : '—'}
            {countryCode && (
              <span className="block text-[11px] font-normal text-text-muted">
                {ZONE_LABELS[zoneOf(countryCode)]}
              </span>
            )}
          </span>
        </div>
        {!countryCode && (
          <p className="mt-2 text-xs text-text-muted">Chọn nước nhận hàng để tính phí gửi.</p>
        )}
        <p className="mt-3 border-t border-white/8 pt-3 text-xs leading-relaxed text-text-muted">
          Thuế nhập khẩu / phí hải quan (nếu có) do người nhận trả khi nhận hàng.{' '}
          <span lang="en">Import duties and taxes, if any, are paid by the recipient.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-surface-2/40 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-2.5 font-semibold text-text">
          <Truck size={18} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
          <span>
            Giao tiêu chuẩn toàn quốc
            <span className="block text-xs font-normal text-text-muted">
              {DELIVERY_ESTIMATE.domestic} · được đồng kiểm với shipper
            </span>
          </span>
        </p>
        <span className="shrink-0 font-display font-bold text-gold">
          {fee === 0 ? <span className="text-success">Miễn phí</span> : formatCurrency(fee)}
        </span>
      </div>
      <p className="mt-3 flex items-start gap-2 border-t border-white/8 pt-3 text-xs text-text-muted">
        <PackageCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Đóng gói chống sốc hai lớp, có mã vận đơn. Miễn phí ship cho đơn từ{' '}
        {formatCurrency(freeShippingThreshold)}.
      </p>
    </div>
  );
}

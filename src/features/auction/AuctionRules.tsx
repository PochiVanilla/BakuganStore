import { EyeOff, Timer } from 'lucide-react';
import type { Auction } from '@/types';
import { cn } from '@/utils/cn';
import { buildAuctionRules } from './auctionRuleText';

/**
 * Hai luật riêng của sàn TD Bakugan, tách ra dùng chung cho trang danh sách
 * và trang chi tiết phiên.
 */

export function AuctionRulesPanel({
  auction,
  className,
}: {
  auction?: Auction;
  className?: string;
}) {
  const rules = buildAuctionRules(auction);

  return (
    <section className={cn('rounded-2xl border border-white/8 bg-surface/60 p-6', className)}>
      <h2 className="mb-1.5 font-display text-base font-bold text-text">Thể lệ đấu giá</h2>
      <p className="mb-5 text-sm text-text-muted">
        Hai luật dưới đây tồn tại để phiên đấu giá công bằng với cả người vào sớm lẫn người vào
        muộn.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {rules.map((rule) => (
          <li key={rule.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"
              aria-hidden="true"
            >
              <rule.icon size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text">{rule.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{rule.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dải cảnh báo hiện khi phiên đang ở trong khung giờ chống bắn tỉa. */
export function AntiSnipeBanner({ auction }: { auction: Auction }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm text-warning"
    >
      <Timer size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <strong>Đang trong {auction.antiSnipeMinutes} phút cuối.</strong> Mỗi lượt đặt lúc này sẽ
        gia hạn phiên thêm {auction.antiSnipeMinutes} phút.
        {auction.extensionCount > 0 && ` Phiên đã gia hạn ${auction.extensionCount} lần.`}
      </span>
    </div>
  );
}

/** Nhãn nhỏ đánh dấu phiên kín. */
export function SealedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/15 px-2.5 py-1 font-display text-[10px] font-bold tracking-wider text-primary-soft',
        className,
      )}
      title="Phiên kín: giá hiện tại được giấu"
    >
      <EyeOff size={11} aria-hidden="true" />
      PHIÊN KÍN
    </span>
  );
}

/** Giá hiển thị cho phiên kín — che số nhưng vẫn giữ nhịp đọc. */
export function HiddenPrice({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-display tracking-[0.18em] text-text-muted', className)}
      title="Giá được giấu cho tới khi phiên kết thúc"
    >
      ••••••
    </span>
  );
}

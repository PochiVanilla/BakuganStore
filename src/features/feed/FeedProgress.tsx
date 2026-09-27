import { cn } from '@/utils/cn';

/** Thanh "đã bán x/y con" của một feed. */
export function FeedProgress({
  sold,
  total,
  className,
}: {
  sold: number;
  total: number;
  className?: string;
}) {
  const percent = total > 0 ? Math.round((sold / total) * 100) : 0;
  const remaining = Math.max(0, total - sold);
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-text-muted">
          Đã bán <span className="font-semibold text-text tabular-nums">{sold}</span>/{total}
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            remaining === 0 ? 'text-text-muted' : 'text-accent-cyan',
          )}
        >
          {remaining === 0 ? 'Hết hàng' : `Còn ${remaining} con`}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"
        role="progressbar"
        aria-label="Số con đã bán"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={sold}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-cyan via-primary to-accent-pink"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

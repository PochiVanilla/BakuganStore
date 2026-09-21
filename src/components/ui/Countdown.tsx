import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/utils/cn';

interface CountdownProps {
  targetIso: string;
  /** Nhãn hiển thị khi đã hết giờ */
  finishedLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onFinish?: () => void;
}

const SIZES = {
  sm: { box: 'min-w-9 px-1.5 py-1 text-sm', label: 'text-[9px]' },
  md: { box: 'min-w-12 px-2 py-1.5 text-lg', label: 'text-[10px]' },
  lg: { box: 'min-w-16 px-3 py-2.5 text-2xl', label: 'text-[11px]' },
} as const;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function Countdown({
  targetIso,
  finishedLabel = 'Đã kết thúc',
  size = 'md',
  className,
}: CountdownProps) {
  const { days, hours, minutes, seconds, isFinished } = useCountdown(targetIso);
  const styles = SIZES[size];

  if (isFinished) {
    return (
      <span className={cn('font-display text-sm font-bold text-text-muted', className)}>
        {finishedLabel}
      </span>
    );
  }

  const units = [
    { value: days, label: 'NGÀY' },
    { value: hours, label: 'GIỜ' },
    { value: minutes, label: 'PHÚT' },
    { value: seconds, label: 'GIÂY' },
  ];

  const isUrgent = days === 0 && hours < 1;

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="timer"
      aria-label={`Còn lại ${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`}
    >
      {units.map((unit, index) => (
        <div key={unit.label} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'rounded-lg border text-center font-display font-bold tabular-nums',
                styles.box,
                isUrgent
                  ? 'border-danger/50 bg-danger/10 text-danger'
                  : 'border-accent-cyan/30 bg-surface-2 text-accent-cyan',
              )}
            >
              {pad(unit.value)}
            </span>
            <span className={cn('mt-1 font-semibold tracking-wider text-text-muted', styles.label)}>
              {unit.label}
            </span>
          </div>
          {index < units.length - 1 && (
            <span className="-mt-4 font-display text-text-muted/50" aria-hidden="true">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`Đánh giá ${value} trên 5 sao`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={cn(star <= Math.round(value) ? 'fill-gold text-gold' : 'text-white/20')}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-xs font-medium text-text-muted">
        {value.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </div>
  );
}

import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

const STEPS = ['Giỏ hàng', 'Thanh toán', 'Hoàn tất'] as const;

/** Giỏ hàng → Thanh toán → Hoàn tất */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs sm:gap-3 sm:text-sm" aria-label="Các bước">
      {STEPS.map((step, index) => {
        const done = index < current || (index === current && index === STEPS.length - 1);
        const active = index === current;
        return (
          <li
            key={step}
            className="flex items-center gap-2 sm:gap-3"
            aria-current={active ? 'step' : undefined}
          >
            {index > 0 && <span className="h-px w-5 bg-white/15 sm:w-10" aria-hidden="true" />}
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                done
                  ? 'border-success/60 bg-success/15 text-success'
                  : active
                    ? 'border-accent-cyan/70 bg-accent-cyan/15 text-accent-cyan'
                    : 'border-white/15 text-text-muted',
              )}
            >
              {done ? <Check size={13} aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn('font-semibold', active ? 'text-text' : 'text-text-muted')}>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

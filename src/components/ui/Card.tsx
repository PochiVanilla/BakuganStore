import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
}

export function Card({ children, className, hoverable = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/8 bg-surface/80 backdrop-blur-sm',
        hoverable &&
          'transition-all duration-300 hover:-translate-y-1 hover:border-accent-cyan/40 hover:shadow-[0_18px_40px_-20px_rgba(123,75,232,0.8)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && (
          <p className="mb-2 font-display text-xs font-bold tracking-[0.28em] text-accent-cyan">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl font-extrabold text-text sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm text-text-muted sm:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Khung chứa chuẩn, dùng cho mọi section để canh lề đồng nhất. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
  );
}

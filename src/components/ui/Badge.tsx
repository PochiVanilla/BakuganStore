import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { BakuganAttribute, ProductBadge } from '@/types';
import { ATTRIBUTE_META } from '@/constants/catalog';

const STATUS_STYLES: Record<ProductBadge, string> = {
  NEW: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/50 shadow-glow-cyan',
  HOT: 'bg-accent-pink/15 text-accent-pink border-accent-pink/50 shadow-glow-pink',
  SALE: 'bg-gold/15 text-gold border-gold/50 shadow-glow-gold',
  RARE: 'bg-primary/20 text-primary-soft border-primary/60 shadow-glow-purple',
  OUT_OF_STOCK: 'bg-white/5 text-text-muted border-white/15',
};

const STATUS_LABELS: Record<ProductBadge, string> = {
  NEW: 'NEW',
  HOT: 'HOT',
  SALE: 'SALE',
  RARE: 'HÀNG HIẾM',
  OUT_OF_STOCK: 'HẾT HÀNG',
};

export function StatusBadge({ type, className }: { type: ProductBadge; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-display text-[10px] font-bold tracking-wider',
        STATUS_STYLES[type],
        className,
      )}
    >
      {STATUS_LABELS[type]}
    </span>
  );
}

export function AttributeBadge({
  attribute,
  size = 'md',
  className,
}: {
  attribute: BakuganAttribute;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = ATTRIBUTE_META[attribute];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{
        borderColor: `${meta.color}66`,
        backgroundColor: `${meta.color}1A`,
        color: meta.color,
      }}
      title={meta.description}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

export function Chip({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'cyan' | 'pink' | 'gold' | 'muted';
}) {
  const tones = {
    default: 'border-white/10 bg-surface-2 text-text-muted',
    cyan: 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan',
    pink: 'border-accent-pink/40 bg-accent-pink/10 text-accent-pink',
    gold: 'border-gold/40 bg-gold/10 text-gold',
    muted: 'border-white/5 bg-white/5 text-text-muted',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

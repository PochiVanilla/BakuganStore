import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { BakuganAttribute } from '@/types';
import { ATTRIBUTE_META } from '@/constants/catalog';
import { AttributeIcon } from './AttributeIcon';

export type StatusBadgeType = 'NEW' | 'RARE' | 'SOLD' | 'SELLING' | 'UPCOMING' | 'SOLD_OUT';

const STATUS_STYLES: Record<StatusBadgeType, string> = {
  NEW: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/50 shadow-glow-cyan',
  RARE: 'bg-primary/20 text-primary-soft border-primary/60 shadow-glow-purple',
  SOLD: 'bg-danger/15 text-danger border-danger/50',
  SELLING: 'bg-success/12 text-success border-success/45',
  UPCOMING: 'bg-gold/15 text-gold border-gold/50 shadow-glow-gold',
  SOLD_OUT: 'bg-white/5 text-text-muted border-white/15',
};

const STATUS_LABELS: Record<StatusBadgeType, string> = {
  NEW: 'MỚI',
  RARE: 'HÀNG HIẾM',
  SOLD: 'SOLD',
  SELLING: 'ĐANG BÁN',
  UPCOMING: 'SẮP MỞ BÁN',
  SOLD_OUT: 'ĐÃ BÁN HẾT',
};

export function StatusBadge({ type, className }: { type: StatusBadgeType; className?: string }) {
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
      <AttributeIcon attribute={attribute} size={size === 'sm' ? 13 : 15} glow />
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

import type { ReactNode } from 'react';
import { CircleAlert, Search, TrendingDown, TrendingUp } from 'lucide-react';
import type { IssueStatus, OrderStatus } from '@/types';
import {
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_STYLES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from '@/constants/orders';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui';

/* ============================================================
   Bộ thành phần dùng chung cho các trang quản trị
   ============================================================ */

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold text-text sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-white/8 bg-surface/80', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-text">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Thẻ số liệu: nhãn · giá trị · so sánh kỳ trước (tuỳ chọn). */
export function StatCard({
  label,
  value,
  icon,
  delta,
  deltaLabel,
  upIsGood = true,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Tỉ lệ thay đổi, VD 0.12 = +12% */
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  hint?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isUp = hasDelta && delta > 0;
  const isGood = hasDelta && (delta === 0 || isUp === upIsGood);

  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl border bg-surface/80 p-4',
        tone === 'warning' && 'border-warning/30',
        tone === 'danger' && 'border-danger/30',
        tone === 'default' && 'border-white/8',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        {icon && (
          <span className="text-text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold break-words text-text sm:text-2xl">{value}</p>
      {hasDelta && (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium',
            isGood ? 'text-success' : 'text-danger',
          )}
        >
          {isUp ? (
            <TrendingUp size={13} aria-hidden="true" />
          ) : (
            <TrendingDown size={13} aria-hidden="true" />
          )}
          {`${delta > 0 ? '+' : ''}${Math.round(delta * 100)}%`}
          {deltaLabel && <span className="font-normal text-text-muted">{deltaLabel}</span>}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Hàng tab lọc nhanh có đếm số — dùng như radio group. */
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: ReadonlyArray<FilterTab<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="-mx-1 scrollbar-none flex gap-1.5 overflow-x-auto px-1 pb-1"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition',
              active
                ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
                : 'border-white/8 bg-surface/60 text-text-muted hover:border-white/20 hover:text-text',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-px text-[10px] tabular-nums',
                  active ? 'bg-accent-cyan/15' : 'bg-white/6',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-white/10 bg-surface-2/80 pr-3 pl-9 text-sm text-text outline-none placeholder:text-text-muted/60 hover:border-white/20 focus:border-accent-cyan focus:shadow-[0_0_0_3px_rgba(63,227,245,0.16)]"
      />
    </label>
  );
}

/** Ô chọn gọn dùng trong thanh lọc (không có label hiển thị). */
export function CompactSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 w-full cursor-pointer rounded-xl border border-white/10 bg-surface-2/80 px-3 text-sm text-text outline-none hover:border-white/20 focus:border-accent-cyan"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface-2">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        ORDER_STATUS_STYLES[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        ISSUE_STATUS_STYLES[status],
      )}
    >
      {ISSUE_STATUS_LABELS[status]}
    </span>
  );
}

/** Khung bảng: cuộn ngang trên màn hình hẹp thay vì làm vỡ bố cục. */
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const th =
  'border-b border-white/8 px-4 py-2.5 text-xs font-medium whitespace-nowrap text-text-muted';
export const td = 'border-b border-white/5 px-4 py-3 align-middle text-text';

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/8 p-4 text-sm text-danger"
    >
      <span className="flex items-center gap-2">
        <CircleAlert size={16} aria-hidden="true" />
        {message}
      </span>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

/** Nhãn định nghĩa dạng "Tên — giá trị" cho các khối thông tin chi tiết. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-xs text-text-muted sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-text">{children}</dd>
    </div>
  );
}

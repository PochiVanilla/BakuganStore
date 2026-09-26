import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/* ============================================================
   Biểu đồ gọn cho trang quản trị — một chuỗi số liệu mỗi biểu đồ.

   - Một màu duy nhất (#9A74EF) cho mọi cột: đã kiểm tra tương phản ≥ 3:1
     trên nền surface tối. Nhãn và số luôn dùng màu chữ, không dùng màu cột.
   - Cột mảnh (tối đa 24px), bo 4px ở đầu dữ liệu, vuông ở đường gốc.
   - Lưới là đường mảnh liền, chìm sau dữ liệu.
   - Rê chuột hoặc Tab tới cột để xem giá trị; luôn có bảng số liệu thay thế.
   ============================================================ */

const SERIES_COLOR = '#9A74EF';

/** Làm tròn trần trục về số đẹp: 1, 2, 2.5, 5 × 10^n */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;
  const step = [1, 2, 2.5, 5, 10].find((candidate) => fraction <= candidate) ?? 10;
  return step * base;
}

export interface ColumnDatum {
  key: string;
  /** Nhãn ngắn dưới trục X */
  label: string;
  /** Nhãn đầy đủ trong tooltip và bảng */
  fullLabel: string;
  value: number;
  /** Dòng phụ trong tooltip, VD "3 đơn" */
  detail?: string;
}

export function ColumnChart({
  data,
  formatValue,
  formatTick,
  caption,
  height = 200,
  categoryLabel = 'Ngày',
}: {
  data: readonly ColumnDatum[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  /** Mô tả biểu đồ cho trình đọc màn hình và tiêu đề bảng số liệu */
  caption: string;
  height?: number;
  /** Tên cột đầu trong bảng số liệu */
  categoryLabel?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const max = niceCeiling(Math.max(0, ...data.map((item) => item.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const peak = data.reduce<ColumnDatum | undefined>(
    (best, item) => (!best || item.value > best.value ? item : best),
    undefined,
  );

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{caption}</figcaption>

      {showTable ? (
        <div id={tableId} className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th className="border-b border-white/8 py-2 text-xs font-medium text-text-muted">
                  {categoryLabel}
                </th>
                <th className="border-b border-white/8 py-2 text-right text-xs font-medium text-text-muted">
                  Giá trị
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.key}>
                  <td className="border-b border-white/5 py-2 text-text-muted">{item.fullLabel}</td>
                  <td className="border-b border-white/5 py-2 text-right text-text tabular-nums">
                    {formatValue(item.value)}
                    {item.detail && (
                      <span className="ml-2 text-xs text-text-muted">{item.detail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[3.25rem_minmax(0,1fr)]">
          {/* Trục Y */}
          <div className="relative" style={{ height }} aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-2 translate-y-1/2 text-[10px] text-text-muted tabular-nums"
                style={{ bottom: `${(tick / max) * 100}%` }}
              >
                {formatTick(tick)}
              </span>
            ))}
          </div>

          {/* Vùng vẽ */}
          <div className="relative" style={{ height }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden="true"
                className={cn('absolute inset-x-0 h-px', tick === 0 ? 'bg-white/15' : 'bg-white/6')}
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end">
              {data.map((item, index) => {
                const percent = (item.value / max) * 100;
                const edge =
                  index === 0
                    ? 'left-0'
                    : index === data.length - 1
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2';
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="group relative flex h-full min-w-0 flex-1 items-end justify-center px-[3px] outline-none"
                    aria-label={`${item.fullLabel}: ${formatValue(item.value)}${item.detail ? `, ${item.detail}` : ''}`}
                  >
                    <span
                      className="block w-full max-w-6 rounded-t-[4px] transition-[filter] group-hover:brightness-125 group-focus-visible:brightness-125"
                      style={{
                        height: item.value > 0 ? `max(${percent}%, 2px)` : 0,
                        backgroundColor: SERIES_COLOR,
                      }}
                    />
                    <span
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute z-10 hidden rounded-lg border border-white/12 bg-surface-3 px-2.5 py-1.5 text-left whitespace-nowrap shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)] group-hover:block group-focus-visible:block',
                        edge,
                      )}
                      style={{ bottom: `calc(${Math.max(percent, 0)}% + 8px)` }}
                    >
                      <span className="block text-sm font-semibold text-text tabular-nums">
                        {formatValue(item.value)}
                      </span>
                      <span className="block text-[11px] text-text-muted">
                        {item.fullLabel}
                        {item.detail ? ` · ${item.detail}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trục X */}
          <span aria-hidden="true" />
          <div className="mt-2 flex" aria-hidden="true">
            {data.map((item, index) => (
              <span
                key={item.key}
                className={cn(
                  'min-w-0 flex-1 truncate text-center text-[10px] text-text-muted tabular-nums',
                  index % 2 === 1 && index !== data.length - 1 && 'hidden sm:block',
                )}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        {peak && peak.value > 0 && !showTable ? (
          <span>
            Cao nhất: <span className="font-semibold text-text">{formatValue(peak.value)}</span> (
            {peak.fullLabel})
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="font-medium text-accent-cyan hover:underline"
        >
          {showTable ? 'Xem biểu đồ' : 'Xem bảng số liệu'}
        </button>
      </div>
    </figure>
  );
}

export interface BarDatum {
  key: string;
  label: ReactNode;
  /** Nhãn dạng chữ cho trình đọc màn hình */
  textLabel: string;
  value: number;
  display: string;
}

/** Danh sách thanh ngang: nhãn bên trái, giá trị ở đầu thanh. */
export function BarList({
  data,
  caption,
  emptyText = 'Chưa có dữ liệu',
}: {
  data: readonly BarDatum[];
  caption: string;
  emptyText?: string;
}) {
  const max = Math.max(0, ...data.map((item) => item.value));
  if (max === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col gap-3" aria-label={caption}>
      {data.map((item) => {
        const percent = (item.value / max) * 82;
        return (
          <li
            key={item.key}
            className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3"
            aria-label={`${item.textLabel}: ${item.display}`}
          >
            <span className="min-w-0 truncate text-xs text-text-muted">{item.label}</span>
            <span className="flex min-w-0 items-center gap-2" aria-hidden="true">
              <span
                className="h-2.5 shrink-0 rounded-r-[4px]"
                style={{
                  width: item.value > 0 ? `max(${percent}%, 3px)` : 0,
                  backgroundColor: SERIES_COLOR,
                }}
              />
              <span className="shrink-0 text-xs font-semibold text-text tabular-nums">
                {item.display}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

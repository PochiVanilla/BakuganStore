import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

function buildPages(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) pages.push('gap');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('gap');
  pages.push(totalPages);

  return pages;
}

export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  return (
    <nav
      aria-label="Phân trang sản phẩm"
      className={cn('flex items-center justify-center gap-1.5', className)}
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-text-muted"
      >
        <ChevronLeft size={18} />
      </button>

      {pages.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1.5 text-text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Trang ${item}`}
            className={cn(
              'h-10 min-w-10 rounded-lg border px-3 font-display text-sm font-bold transition',
              item === page
                ? 'border-transparent gradient-cta text-white shadow-glow-pink'
                : 'border-white/10 bg-surface-2 text-text-muted hover:border-accent-cyan/50 hover:text-accent-cyan',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Trang sau"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-text-muted"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}

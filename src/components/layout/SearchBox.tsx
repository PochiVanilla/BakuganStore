import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, LoaderCircle } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import type { BakuganItem } from '@/types';
import { ROUTES } from '@/constants/routes';
import { searchSuggestions } from '@/services/api/feedService';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useClickOutside } from '@/hooks/useClickOutside';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { RefImage } from '@/components/ui';

interface SearchBoxProps {
  onNavigate?: () => void;
  className?: string;
}

const MIN_KEYWORD_LENGTH = 2;

export function SearchBox({ onNavigate, className }: SearchBoxProps) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState<{ query: string; items: BakuganItem[] }>({
    query: '',
    items: [],
  });
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounced = useDebouncedValue(keyword, 280);
  const trimmed = debounced.trim();
  const isSearchable = trimmed.length >= MIN_KEYWORD_LENGTH;
  const containerRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false), isOpen);

  // Kết quả chỉ hợp lệ khi khớp đúng từ khoá hiện tại — suy ra khi render,
  // không cần setState dọn dẹp trong effect.
  const suggestions = isSearchable && result.query === trimmed ? result.items : [];
  const isLoading = isSearchable && result.query !== trimmed;

  useEffect(() => {
    if (!isSearchable) return;

    let cancelled = false;
    searchSuggestions(trimmed)
      .then(({ items }) => {
        if (cancelled) return;
        setResult({ query: trimmed, items });
        setIsOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        if (!cancelled) setResult({ query: trimmed, items: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [trimmed, isSearchable]);

  const goToSearch = (): void => {
    if (!keyword.trim()) return;
    navigate(`${ROUTES.feeds}?q=${encodeURIComponent(keyword.trim())}`);
    setIsOpen(false);
    onNavigate?.();
  };

  const goToItem = (item: BakuganItem): void => {
    navigate(ROUTES.itemDetail(item.code));
    setIsOpen(false);
    setKeyword('');
    onNavigate?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = suggestions[activeIndex];
      if (active) goToItem(active);
      else goToSearch();
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-2/80 px-4 py-2.5 transition-colors focus-within:border-accent-cyan/60 focus-within:shadow-[0_0_0_3px_rgba(63,227,245,0.12)]">
        <Search size={17} className="shrink-0 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tìm tên hoặc mã Bakugan…"
          aria-label="Tìm Bakugan theo tên hoặc mã"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="search-suggestions"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted/70"
        />
        {isLoading && (
          <LoaderCircle size={15} className="animate-spin text-accent-cyan" aria-hidden="true" />
        )}
        {keyword && !isLoading && (
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              setIsOpen(false);
            }}
            aria-label="Xoá từ khoá"
            className="rounded-full p-0.5 text-text-muted transition hover:text-text"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (suggestions.length > 0 || (isSearchable && !isLoading)) && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            id="search-suggestions"
            role="listbox"
            aria-label="Gợi ý Bakugan"
            className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
          >
            {suggestions.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-text-muted">
                Không có Bakugan nào khớp “{trimmed}” trên các feed.
              </p>
            ) : (
              <>
                <ul className="max-h-80 overflow-y-auto py-1.5">
                  {suggestions.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onClick={() => goToItem(item)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
                          index === activeIndex ? 'bg-white/8' : 'hover:bg-white/5',
                        )}
                      >
                        <RefImage
                          src={item.image}
                          alt=""
                          loading="lazy"
                          width={44}
                          height={44}
                          className={cn(
                            'h-11 w-11 shrink-0 rounded-lg bg-surface-2 object-cover',
                            item.status === 'sold' && 'opacity-40 grayscale',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text">
                            <span className="font-mono text-xs text-accent-cyan">{item.code}</span>{' '}
                            {item.name}
                          </span>
                          <span className="block text-xs">
                            {item.status === 'sold' ? (
                              <span className="font-bold text-danger">SOLD</span>
                            ) : (
                              <span className="text-gold">{formatCurrency(item.price)}</span>
                            )}
                            {item.feedNumber && (
                              <span className="text-text-muted"> · Feed #{item.feedNumber}</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={goToSearch}
                  className="w-full border-t border-white/8 px-4 py-3 text-center text-sm font-semibold text-accent-cyan transition hover:bg-accent-cyan/10"
                >
                  Xem tất cả kết quả cho “{keyword}”
                </button>
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

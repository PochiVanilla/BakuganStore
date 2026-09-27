import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { BakuganAttribute, FeedPost, FeedStatusFilter } from '@/types';
import { BAKUGAN_ATTRIBUTES, FEED_STATUS_FILTERS } from '@/types';
import { ROUTES } from '@/constants/routes';
import { ATTRIBUTE_META, FEED_FILTER_LABELS } from '@/constants/catalog';
import { fetchFeeds, searchItems } from '@/services/api/feedService';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { cn } from '@/utils/cn';
import {
  AttributeIcon,
  Button,
  Container,
  EmptyState,
  FeedCardSkeleton,
  ItemGridSkeleton,
  Seo,
} from '@/components/ui';
import { FeedCard } from '@/features/feed/FeedCard';
import { ItemCard } from '@/features/feed/ItemCard';

function isStatus(value: string | null): value is FeedStatusFilter {
  return Boolean(value) && (FEED_STATUS_FILTERS as readonly string[]).includes(value!);
}

function isAttribute(value: string | null): value is BakuganAttribute {
  return Boolean(value) && (BAKUGAN_ATTRIBUTES as readonly string[]).includes(value!);
}

/** Hiện dần: vẽ 12 feed trước, còn lại bấm "Xem thêm" — mở trang nhanh hơn trên điện thoại. */
const FEEDS_PER_PAGE = 12;

function FeedGrid({ feeds }: { feeds: readonly FeedPost[] }) {
  const [visible, setVisible] = useState(FEEDS_PER_PAGE);
  const shown = feeds.slice(0, visible);
  const remaining = feeds.length - shown.length;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((feed, index) => (
          <FeedCard key={feed.id} feed={feed} priority={index < 2} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setVisible((count) => count + FEEDS_PER_PAGE)}>
            Xem thêm {Math.min(remaining, FEEDS_PER_PAGE)} feed (còn {remaining})
          </Button>
        </div>
      )}
    </>
  );
}

export default function FeedsPage() {
  const [params, setParams] = useSearchParams();
  const revision = useLiveRevision();
  const status: FeedStatusFilter = isStatus(params.get('trang-thai'))
    ? (params.get('trang-thai') as FeedStatusFilter)
    : 'all';
  const attributeParam = params.get('he');
  const attribute = isAttribute(attributeParam) ? attributeParam : undefined;
  const keyword = params.get('q')?.trim() ?? '';
  const includeSold = params.get('ca-da-ban') === '1';
  const [draft, setDraft] = useState(keyword);
  const [trackedKeyword, setTrackedKeyword] = useState(keyword);
  if (trackedKeyword !== keyword) {
    setTrackedKeyword(keyword);
    setDraft(keyword);
  }

  const isSearching = Boolean(keyword || attribute);
  const allFeeds = useAsync(() => fetchFeeds({}), [revision], { keepPreviousData: true });
  const feeds = useAsync(
    () => fetchFeeds({ status, keyword, attribute }),
    [status, keyword, attribute, revision],
  );
  const items = useAsync(
    () =>
      searchItems({
        keyword,
        attributes: attribute ? [attribute] : undefined,
        includeSold,
      }),
    [keyword, attribute, includeSold, revision],
    { enabled: isSearching },
  );

  const counts = FEED_STATUS_FILTERS.reduce(
    (result, value) => {
      result[value] =
        value === 'all'
          ? (allFeeds.data?.length ?? 0)
          : (allFeeds.data?.filter((feed) => feed.status === value).length ?? 0);
      return result;
    },
    {} as Record<FeedStatusFilter, number>,
  );

  const update = (patch: Record<string, string | undefined>): void => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setParams(next, { replace: true });
  };

  const onSearch = (event: FormEvent): void => {
    event.preventDefault();
    update({ q: draft.trim() || undefined });
  };

  return (
    <>
      <Seo
        title="Feed bán Bakugan"
        description="Mỗi feed là một lô Bakugan TD shop vừa nhập: ảnh thật cả lô, mỗi con một mã riêng, con nào có người chốt sẽ hiện SOLD."
        path={ROUTES.feeds}
      />

      <Container className="py-8 sm:py-12">
        <header className="max-w-3xl">
          <p className="font-display text-xs font-bold tracking-[0.3em] text-accent-cyan">
            FEED BÁN
          </p>
          <h1 className="mt-2 font-display text-3xl font-black text-text sm:text-4xl">
            Bakugan bán theo lô
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">
            Shop nhập Bakugan theo lô nên mỗi con một tình trạng riêng. Mỗi feed là một lô: ảnh chụp
            cả lô và danh sách từng con kèm mã (VD <span className="font-mono">BK-0231</span>
            ). Con nào có người chốt sẽ hiện <span className="font-bold text-danger">SOLD</span> —
            ai đặt trước được trước.
          </p>
        </header>

        <form onSubmit={onSearch} className="mt-6 flex max-w-xl gap-2" role="search">
          <label className="relative flex-1">
            <span className="sr-only">Tìm theo tên hoặc mã Bakugan</span>
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tên hoặc mã, VD: Dragonoid, BK-0231"
              className="h-11 w-full rounded-xl border border-white/10 bg-surface-2 pr-3 pl-10 text-sm text-text outline-none placeholder:text-text-muted/60 focus:border-accent-cyan"
            />
          </label>
          <Button type="submit">Tìm</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Lọc theo hệ">
          {BAKUGAN_ATTRIBUTES.map((value) => {
            const active = attribute === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ he: active ? undefined : value })}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  active
                    ? 'text-background'
                    : 'border-white/10 bg-surface-2 text-text-muted hover:text-text',
                )}
                style={
                  active
                    ? {
                        backgroundColor: ATTRIBUTE_META[value].color,
                        borderColor: ATTRIBUTE_META[value].color,
                      }
                    : undefined
                }
              >
                <AttributeIcon attribute={value} size={14} />
                {ATTRIBUTE_META[value].label}
              </button>
            );
          })}
          {isSearching && (
            <button
              type="button"
              onClick={() => update({ q: undefined, he: undefined })}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-accent-pink"
            >
              <X size={13} aria-hidden="true" />
              Bỏ lọc
            </button>
          )}
        </div>

        {isSearching && (
          <section className="mt-10" aria-labelledby="matched-items">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="matched-items" className="font-display text-xl font-bold text-text">
                Bakugan khớp {keyword && <span className="text-accent-cyan">“{keyword}”</span>}
                {attribute && (
                  <span style={{ color: ATTRIBUTE_META[attribute].color }}>
                    {' '}
                    hệ {ATTRIBUTE_META[attribute].label}
                  </span>
                )}
              </h2>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={includeSold}
                  onChange={(event) =>
                    update({ 'ca-da-ban': event.target.checked ? '1' : undefined })
                  }
                  className="h-4 w-4 accent-[var(--color-accent-cyan)]"
                />
                Hiện cả con đã bán
              </label>
            </div>
            <div className="mt-4">
              {items.isLoading ? (
                <ItemGridSkeleton count={4} />
              ) : items.data && items.data.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {items.data.map((item) => (
                    <ItemCard key={item.id} item={item} showFeed />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/12 px-5 py-8 text-center text-sm text-text-muted">
                  Chưa có con nào còn bán khớp tìm kiếm. Hỏi trợ lý AI ở góc phải hoặc chờ feed mới
                  nhé!
                </p>
              )}
            </div>
          </section>
        )}

        <section className="mt-10" aria-labelledby="feed-list">
          <h2 id="feed-list" className="sr-only">
            Danh sách feed
          </h2>
          <div
            role="radiogroup"
            aria-label="Lọc feed theo trạng thái"
            className="-mx-1 scrollbar-none flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {FEED_STATUS_FILTERS.map((value) => {
              const active = value === status;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ 'trang-thai': value === 'all' ? undefined : value })}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition',
                    active
                      ? 'border-accent-cyan/60 bg-accent-cyan/12 text-accent-cyan'
                      : 'border-white/10 bg-surface/60 text-text-muted hover:text-text',
                  )}
                >
                  {FEED_FILTER_LABELS[value]}
                  <span className="rounded-md bg-white/8 px-1.5 text-[11px] tabular-nums">
                    {counts[value]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            {feeds.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <FeedCardSkeleton key={index} />
                ))}
              </div>
            ) : feeds.error ? (
              <EmptyState title="Chưa tải được feed" description={feeds.error} />
            ) : feeds.data && feeds.data.length > 0 ? (
              // Đổi bộ lọc thì hiện lại từ đầu (key mới -> số feed đang hiện quay về 12).
              <FeedGrid key={`${status}|${keyword}|${attribute ?? ''}`} feeds={feeds.data} />
            ) : (
              <EmptyState
                title="Không có feed nào"
                description={
                  isSearching
                    ? 'Không feed nào có Bakugan khớp tìm kiếm.'
                    : 'Chưa có feed ở mục này, quay lại sau nhé.'
                }
              />
            )}
          </div>
        </section>
      </Container>
    </>
  );
}

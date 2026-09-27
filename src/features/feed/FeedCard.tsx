import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import type { FeedPost } from '@/types';
import { ROUTES } from '@/constants/routes';
import { ATTRIBUTE_META } from '@/constants/catalog';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { AttributeIcon, Countdown, RefImage, StatusBadge } from '@/components/ui';
import { FeedProgress } from './FeedProgress';
import { attributesOf, FEED_BADGE } from './feedUi';

/** Một bài đăng feed: ảnh cả lô, số con đã bán / còn lại, khoảng giá. */
export function FeedCard({
  feed,
  priority = false,
  className,
}: {
  feed: FeedPost;
  /** Ảnh nằm ở đầu trang: tải ngay */
  priority?: boolean;
  className?: string;
}) {
  const detail = ROUTES.feedDetail(feed.number);
  const attributes = attributesOf(feed);
  const isUpcoming = feed.status === 'upcoming';
  const isSoldOut = feed.status === 'sold-out';

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-surface/80 transition-colors duration-300 hover:border-accent-cyan/40',
        className,
      )}
    >
      <Link
        to={detail}
        className="relative block overflow-hidden"
        aria-label={`Xem feed #${feed.number}: ${feed.title}`}
      >
        <RefImage
          src={feed.images[0]}
          alt={`Ảnh chụp lô hàng feed #${feed.number}`}
          width={1280}
          height={720}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={cn(
            'aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
            isSoldOut && 'opacity-60 grayscale-[35%]',
          )}
        />
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <StatusBadge type={FEED_BADGE[feed.status]} className="backdrop-blur" />
          <span className="rounded-md border border-white/15 bg-background/80 px-2 py-0.5 font-display text-[10px] font-bold tracking-wider text-text backdrop-blur">
            FEED #{feed.number}
          </span>
        </span>
        {isUpcoming && (
          <span className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/30 bg-background/85 px-3 py-2 backdrop-blur">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold">
              <Clock size={13} aria-hidden="true" />
              Mở bán {formatDateTime(feed.opensAt)}
            </span>
            <Countdown targetIso={feed.opensAt} size="sm" finishedLabel="Đã mở bán" />
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] text-text-muted">
          Đăng {formatRelativeTime(feed.publishedAt)} · {feed.itemCount} con
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-base leading-snug font-bold text-text">
          <Link to={detail} className="transition-colors hover:text-accent-cyan">
            {feed.title}
          </Link>
        </h3>

        {attributes.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Các hệ có trong feed">
            {attributes.map((attribute) => (
              <li key={attribute} title={ATTRIBUTE_META[attribute].label}>
                <AttributeIcon attribute={attribute} size={18} />
                <span className="sr-only">{ATTRIBUTE_META[attribute].label}</span>
              </li>
            ))}
          </ul>
        )}

        <FeedProgress sold={feed.soldCount} total={feed.itemCount} className="mt-3" />

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="min-w-0 text-sm">
            {feed.priceRange ? (
              <span className="font-display font-bold text-gold">
                {feed.priceRange.min === feed.priceRange.max
                  ? formatCurrency(feed.priceRange.min)
                  : `${formatCurrency(feed.priceRange.min)} – ${formatCurrency(feed.priceRange.max)}`}
              </span>
            ) : (
              <span className="text-text-muted">Đã bán hết</span>
            )}
          </p>
          <Link
            to={detail}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-cyan transition hover:gap-1.5"
          >
            {isSoldOut ? 'Xem lại' : isUpcoming ? 'Xem trước' : 'Chọn Bakugan'}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

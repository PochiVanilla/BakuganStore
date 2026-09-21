import { Link } from 'react-router-dom';
import { Clock, Eye } from 'lucide-react';
import type { BlogPost } from '@/types';
import { ROUTES } from '@/constants/routes';
import { formatDate, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Chip } from '@/components/ui';

export function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-surface/80 transition-all duration-300 hover:-translate-y-1 hover:border-accent-cyan/40 hover:shadow-[0_18px_44px_-22px_rgba(63,227,245,0.6)]',
        featured && 'sm:flex-row',
      )}
    >
      <Link
        to={ROUTES.blogDetail(post.slug)}
        className={cn('overflow-hidden bg-surface-2', featured && 'sm:w-1/2 sm:shrink-0')}
        aria-label={post.title}
      >
        <img
          src={post.coverImage}
          alt={post.title}
          loading="lazy"
          decoding="async"
          width={1200}
          height={630}
          className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip tone="cyan">{post.category}</Chip>
          <span className="text-xs text-text-muted">{formatDate(post.publishedAt)}</span>
        </div>

        <Link to={ROUTES.blogDetail(post.slug)}>
          <h3
            className={cn(
              'font-display leading-snug font-bold text-text transition-colors group-hover:text-accent-cyan',
              featured ? 'text-xl' : 'line-clamp-2 text-base',
            )}
          >
            {post.title}
          </h3>
        </Link>

        <p
          className={cn(
            'mt-2.5 text-sm text-text-muted',
            featured ? 'line-clamp-4' : 'line-clamp-3',
          )}
        >
          {post.excerpt}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} aria-hidden="true" />
            {post.readingMinutes} phút đọc
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye size={13} aria-hidden="true" />
            {formatNumber(post.viewCount)} lượt xem
          </span>
          <span className="ml-auto font-medium text-text">{post.authorName}</span>
        </div>
      </div>
    </article>
  );
}

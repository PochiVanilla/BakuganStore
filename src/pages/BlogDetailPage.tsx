import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Clock, Eye, User } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { fetchBlogPostBySlug, fetchRelatedPosts } from '@/services/api/blogService';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatNumber } from '@/utils/format';
import {
  Button,
  Chip,
  Container,
  EmptyState,
  SectionHeading,
  Seo,
  Skeleton,
} from '@/components/ui';
import { BlogCard } from '@/features/blog/BlogCard';

export default function BlogDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: post, isLoading, error } = useAsync(() => fetchBlogPostBySlug(slug), [slug]);
  const { data: related } = useAsync(() => fetchRelatedPosts(slug, 3), [slug]);

  if (isLoading) {
    return (
      <Container className="py-10">
        <div className="mx-auto max-w-3xl space-y-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Container>
    );
  }

  if (error || !post) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Không tìm thấy bài viết"
          description={error ?? 'Bài viết này có thể đã bị gỡ.'}
          action={<Button onClick={() => navigate(ROUTES.blog)}>Về trang Blog</Button>}
        />
      </Container>
    );
  }

  return (
    <>
      <Seo
        title={post.title}
        description={post.excerpt}
        image={post.coverImage}
        path={ROUTES.blogDetail(post.slug)}
        type="article"
      />

      <Container className="py-6 sm:py-10">
        <nav
          aria-label="Đường dẫn"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-text-muted"
        >
          <Link to={ROUTES.home} className="transition hover:text-accent-cyan">
            Trang chủ
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to={ROUTES.blog} className="transition hover:text-accent-cyan">
            Blog
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="truncate text-text">{post.title}</span>
        </nav>

        <article className="mx-auto max-w-3xl">
          <header>
            <Chip tone="cyan">{post.category}</Chip>
            <h1 className="mt-4 font-display text-3xl leading-tight font-extrabold text-text sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-text-muted">{post.excerpt}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-white/8 py-3.5 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden="true" />
                {post.authorName}
              </span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} aria-hidden="true" />
                {post.readingMinutes} phút đọc
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye size={14} aria-hidden="true" />
                {formatNumber(post.viewCount)} lượt xem
              </span>
            </div>
          </header>

          <img
            src={post.coverImage}
            alt={post.title}
            width={1200}
            height={630}
            className="mt-6 aspect-[16/9] w-full rounded-2xl border border-white/8 bg-surface-2 object-cover"
          />

          <div className="mt-8">
            {post.sections.map((section, index) => (
              <section key={section.heading ?? `section-${index}`} className="mb-8 last:mb-0">
                {section.heading && (
                  <h2 className="mb-3 font-display text-xl font-bold text-text">
                    {section.heading}
                  </h2>
                )}

                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="mb-4 text-base leading-relaxed text-text-muted last:mb-0"
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="my-4 space-y-2 pl-1">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-base text-text-muted"
                      >
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                          aria-hidden="true"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}

                {section.quote && (
                  <blockquote className="my-5 border-l-4 border-accent-pink/60 bg-accent-pink/5 py-3 pr-4 pl-5">
                    <p className="font-display text-base leading-relaxed text-text italic">
                      “{section.quote}”
                    </p>
                  </blockquote>
                )}
              </section>
            ))}
          </div>

          <footer className="mt-10 border-t border-white/8 pt-6">
            <h2 className="mb-3 text-sm font-semibold text-text-muted">Thẻ bài viết</h2>
            <ul className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Chip tone="muted">#{tag}</Chip>
                </li>
              ))}
            </ul>
          </footer>
        </article>

        {related && related.length > 0 && (
          <section className="mt-16">
            <SectionHeading eyebrow="ĐỌC TIẾP" title="Bài viết liên quan" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <BlogCard key={item.id} post={item} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}

import { useState } from 'react';
import { Search, Newspaper, X } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { BLOG_CATEGORIES, MOCK_BLOG_POSTS } from '@/mocks';
import { fetchBlogPosts } from '@/services/api/blogService';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/utils/cn';
import { BlogCardSkeleton, Button, Container, EmptyState, Pagination, Seo } from '@/components/ui';
import { BlogCard } from '@/features/blog/BlogCard';

const ALL_TAGS = Array.from(new Set(MOCK_BLOG_POSTS.flatMap((post) => post.tags))).slice(0, 12);

export default function BlogPage() {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const debouncedKeyword = useDebouncedValue(keyword, 300);

  const { data, isLoading } = useAsync(
    () => fetchBlogPosts({ keyword: debouncedKeyword, category, tag, page, pageSize: 6 }),
    [debouncedKeyword, category, tag, page],
  );

  const posts = data?.items ?? [];
  const hasFilter = Boolean(debouncedKeyword || category || tag);

  const resetFilters = (): void => {
    setKeyword('');
    setCategory(undefined);
    setTag(undefined);
    setPage(1);
  };

  return (
    <>
      <Seo
        title="Blog"
        description="Hướng dẫn phân biệt Bakugan chính hãng, mẹo bảo quản, kinh nghiệm đấu giá và tin tức mới nhất từ TD Bakugan."
        path={ROUTES.blog}
      />

      <Container className="py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
            Góc kiến thức Bakugan
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted sm:text-base">
            Kinh nghiệm thực tế từ đội ngũ TD Bakugan và cộng đồng người chơi Việt Nam.
          </p>
        </header>

        {/* Tìm kiếm + lọc */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-2/80 px-4 py-3 transition focus-within:border-accent-cyan/60">
            <Search size={17} className="shrink-0 text-text-muted" aria-hidden="true" />
            <label htmlFor="blog-search" className="sr-only">
              Tìm bài viết
            </label>
            <input
              id="blog-search"
              type="search"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm bài viết theo tiêu đề hoặc chủ đề…"
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted/70"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory(undefined);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                !category
                  ? 'border-accent-cyan/50 bg-accent-cyan/12 text-accent-cyan'
                  : 'border-white/10 bg-surface-2 text-text-muted hover:text-text',
              )}
            >
              Tất cả
            </button>
            {BLOG_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setCategory(category === item ? undefined : item);
                  setPage(1);
                }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                  category === item
                    ? 'border-accent-cyan/50 bg-accent-cyan/12 text-accent-cyan'
                    : 'border-white/10 bg-surface-2 text-text-muted hover:text-text',
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-text-muted">Thẻ:</span>
            {ALL_TAGS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTag(tag === item ? undefined : item);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs transition',
                  tag === item
                    ? 'border-accent-pink/50 bg-accent-pink/12 text-accent-pink'
                    : 'border-white/8 bg-white/3 text-text-muted hover:text-text',
                )}
              >
                #{item}
              </button>
            ))}
            {hasFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-text-muted transition hover:text-accent-pink"
              >
                <X size={12} aria-hidden="true" />
                Xoá lọc
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <BlogCardSkeleton key={index} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Newspaper size={26} aria-hidden="true" />}
            title="Không tìm thấy bài viết nào"
            description="Thử từ khoá khác hoặc bỏ bớt bộ lọc danh mục và thẻ."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Xoá bộ lọc
              </Button>
            }
          />
        ) : (
          <>
            {page === 1 && !hasFilter && posts[0] && (
              <div className="mb-5">
                <BlogCard post={posts[0]} featured />
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(page === 1 && !hasFilter ? posts.slice(1) : posts).map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={setPage}
            className="mt-10"
          />
        )}
      </Container>
    </>
  );
}

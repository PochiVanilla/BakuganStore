import { useState } from 'react';
import { LayoutGrid, Rows3, SlidersHorizontal, Search } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { SORT_LABELS } from '@/constants/catalog';
import { PRODUCT_SORTS, type ProductSort } from '@/types';
import { fetchProducts } from '@/services/api/productService';
import { useAsync } from '@/hooks/useAsync';
import {
  Button,
  Container,
  Drawer,
  EmptyState,
  Pagination,
  ProductGridSkeleton,
  Seo,
} from '@/components/ui';
import { ProductCard } from '@/features/products/ProductCard';
import { ProductFilters } from '@/features/products/ProductFilters';
import { useProductFilters } from '@/features/products/useProductFilters';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function ProductsPage() {
  const filters = useProductFilters();
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const { data, isLoading, error } = useAsync(
    () => fetchProducts(filters.query),
    [JSON.stringify(filters.query)],
  );

  const products = data?.items ?? [];

  return (
    <>
      <Seo
        title="Tất cả sản phẩm"
        description="Khám phá hơn 30 mẫu Bakugan chính hãng theo hệ Pyrus, Aquos, Subterra, Haos, Darkus, Ventus và đầy đủ các dòng từ Battle Brawlers đến Geogan Rising."
        path={ROUTES.products}
      />

      <Container className="py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
            {filters.keyword ? `Kết quả cho “${filters.keyword}”` : 'Tất cả sản phẩm'}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {isLoading
              ? 'Đang tải danh sách…'
              : `Tìm thấy ${formatNumber(data?.total ?? 0)} sản phẩm phù hợp.`}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sidebar lọc — desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-2xl border border-white/8 bg-surface/80 p-5">
              <ProductFilters {...filters} />
            </div>
          </aside>

          <div className="min-w-0">
            {/* Thanh công cụ */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-surface/60 p-3">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<SlidersHorizontal size={15} />}
                onClick={() => setIsFilterDrawerOpen(true)}
                className="lg:hidden"
              >
                Bộ lọc
                {filters.activeCount > 0 && (
                  <span className="ml-1 rounded-full bg-accent-pink px-1.5 text-[10px] font-bold text-white">
                    {filters.activeCount}
                  </span>
                )}
              </Button>

              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="sort-select" className="hidden text-sm text-text-muted sm:block">
                  Sắp xếp:
                </label>
                <select
                  id="sort-select"
                  value={filters.sort}
                  onChange={(event) => filters.setSort(event.target.value as ProductSort)}
                  className="h-9 cursor-pointer rounded-lg border border-white/10 bg-surface-2 px-3 text-sm text-text transition outline-none focus:border-accent-cyan"
                >
                  {PRODUCT_SORTS.map((sort) => (
                    <option key={sort} value={sort} className="bg-surface-2">
                      {SORT_LABELS[sort]}
                    </option>
                  ))}
                </select>

                <div
                  className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-surface-2 p-0.5"
                  role="group"
                  aria-label="Kiểu hiển thị"
                >
                  <button
                    type="button"
                    onClick={() => setLayout('grid')}
                    aria-label="Hiển thị dạng lưới"
                    aria-pressed={layout === 'grid'}
                    className={cn(
                      'rounded-md p-1.5 transition',
                      layout === 'grid'
                        ? 'bg-primary/25 text-accent-cyan'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayout('list')}
                    aria-label="Hiển thị dạng danh sách"
                    aria-pressed={layout === 'list'}
                    className={cn(
                      'rounded-md p-1.5 transition',
                      layout === 'list'
                        ? 'bg-primary/25 text-accent-cyan'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    <Rows3 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Danh sách */}
            {isLoading ? (
              <ProductGridSkeleton count={9} />
            ) : error ? (
              <EmptyState
                title="Không tải được danh sách sản phẩm"
                description={error}
                action={
                  <Button variant="secondary" onClick={() => window.location.reload()}>
                    Thử lại
                  </Button>
                }
              />
            ) : products.length === 0 ? (
              <EmptyState
                icon={<Search size={26} aria-hidden="true" />}
                title="Không tìm thấy sản phẩm nào"
                description="Thử bỏ bớt một vài tiêu chí lọc hoặc dùng từ khoá khác xem sao."
                action={
                  <Button variant="outline" onClick={filters.resetFilters}>
                    Xoá toàn bộ bộ lọc
                  </Button>
                }
              />
            ) : (
              <div
                className={cn(
                  layout === 'grid'
                    ? 'grid grid-cols-2 gap-4 sm:grid-cols-3'
                    : 'flex flex-col gap-4',
                )}
              >
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} layout={layout} />
                ))}
              </div>
            )}

            {data && data.totalPages > 1 && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={filters.setPage}
                className="mt-10"
              />
            )}
          </div>
        </div>
      </Container>

      {/* Bộ lọc dạng drawer cho mobile */}
      <Drawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Bộ lọc sản phẩm"
        side="left"
        widthClassName="max-w-sm"
        footer={
          <Button fullWidth onClick={() => setIsFilterDrawerOpen(false)}>
            Xem {formatNumber(data?.total ?? 0)} kết quả
          </Button>
        }
      >
        <div className="p-5">
          <ProductFilters {...filters} />
        </div>
      </Drawer>
    </>
  );
}

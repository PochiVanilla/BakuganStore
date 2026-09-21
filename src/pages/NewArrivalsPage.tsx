import { Sparkles, PackageOpen } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { fetchNewArrivals } from '@/services/api/productService';
import { useAsync } from '@/hooks/useAsync';
import { formatNumber } from '@/utils/format';
import { ButtonLink, Container, EmptyState, ProductGridSkeleton, Seo } from '@/components/ui';
import { ProductCard } from '@/features/products/ProductCard';

export default function NewArrivalsPage() {
  const { data, isLoading, error } = useAsync(() => fetchNewArrivals(24), []);
  const products = data ?? [];

  return (
    <>
      <Seo
        title="Hàng mới về"
        description="Những mẫu Bakugan vừa được TD Bakugan nhập về trong 30 ngày gần nhất, đã kiểm tra và chụp ảnh thực tế."
        path={ROUTES.newArrivals}
      />

      <Container className="py-8 sm:py-12">
        <header className="relative mb-10 overflow-hidden rounded-3xl border border-accent-cyan/25 bg-surface/70 p-8 sm:p-10">
          <div
            className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent-cyan/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-3.5 py-1.5 text-xs font-bold text-accent-cyan shadow-glow-cyan">
              <Sparkles size={13} aria-hidden="true" />
              NEW ARRIVALS
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-text sm:text-4xl">
              Hàng mới về trong 30 ngày
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
              Mỗi sản phẩm ở đây đều vừa qua khâu kiểm tra cơ cấu bung nở, vệ sinh khoang nam châm
              và chụp ảnh thực tế. Số lượng thường rất hạn chế nên hàng hiếm hay hết nhanh.
            </p>
            {!isLoading && (
              <p className="mt-4 font-display text-sm font-bold text-gold">
                {formatNumber(products.length)} sản phẩm đang có sẵn
              </p>
            )}
          </div>
        </header>

        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : error ? (
          <EmptyState title="Không tải được danh sách" description={error} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={26} aria-hidden="true" />}
            title="Chưa có hàng mới trong 30 ngày qua"
            description="Lô hàng tiếp theo đang trên đường về kho. Theo dõi trang Blog để biết lịch mở bán."
            action={<ButtonLink to={ROUTES.products}>Xem toàn bộ sản phẩm</ButtonLink>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}

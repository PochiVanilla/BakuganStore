import { Link } from 'react-router-dom';
import { ArrowUpRight, Flame, Gavel, Sparkles } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import {
  fetchBestSellers,
  fetchFeaturedProducts,
  fetchNewArrivals,
} from '@/services/api/productService';
import { fetchAuctions } from '@/services/api/auctionService';
import { fetchLatestPosts } from '@/services/api/blogService';
import { MOCK_PRODUCTS } from '@/mocks';
import { useAsync } from '@/hooks/useAsync';
import {
  Container,
  SectionHeading,
  Seo,
  ProductGridSkeleton,
  AuctionCardSkeleton,
  BlogCardSkeleton,
} from '@/components/ui';
import { ProductCard } from '@/features/products/ProductCard';
import { AuctionCard } from '@/features/auction/AuctionCard';
import { BlogCard } from '@/features/blog/BlogCard';
import { Hero } from '@/features/home/Hero';
import { AttributeGrid, SeriesGrid } from '@/features/home/CategoryGrid';
import { Commitments } from '@/features/home/Commitments';

function ViewAllLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
    >
      {label}
      <ArrowUpRight size={15} aria-hidden="true" />
    </Link>
  );
}

export default function HomePage() {
  const newArrivals = useAsync(() => fetchNewArrivals(8), []);
  const auctions = useAsync(() => fetchAuctions(), []);
  const bestSellers = useAsync(() => fetchBestSellers(8), []);
  const featured = useAsync(() => fetchFeaturedProducts(4), []);
  const posts = useAsync(() => fetchLatestPosts(3), []);

  const liveAuctions = (auctions.data ?? []).filter((auction) => auction.status === 'live');
  const upcomingAuctions = (auctions.data ?? []).filter((auction) => auction.status === 'upcoming');
  const highlightAuctions = [...liveAuctions, ...upcomingAuctions].slice(0, 3);

  return (
    <>
      <Seo
        title="TD Bakugan"
        description="Shop Bakugan chính hãng tại Việt Nam: hơn 30 mẫu sưu tầm, hàng mới về mỗi tuần và sàn đấu giá dành cho người chơi lâu năm. Giao nhanh toàn quốc, đổi trả 7 ngày."
        path={ROUTES.home}
      />

      <Hero productCount={MOCK_PRODUCTS.length} liveAuctions={liveAuctions.length} />

      <AttributeGrid />

      {/* Hàng mới về */}
      <section className="py-12 sm:py-16">
        <Container>
          <SectionHeading
            eyebrow="HÀNG MỚI VỀ"
            title="Vừa lên kệ trong 30 ngày"
            description="Những chiến binh mới nhất được shop nhập về và kiểm tra xong."
            action={<ViewAllLink to={ROUTES.newArrivals} label="Xem tất cả hàng mới" />}
          />

          {newArrivals.isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {newArrivals.data?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Đấu giá — điểm khác biệt chính */}
      <section className="relative overflow-hidden py-14 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-pink/8 via-transparent to-primary/8"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent-pink/60 to-transparent"
          aria-hidden="true"
        />

        <Container className="relative">
          <SectionHeading
            eyebrow="ĐẶC QUYỀN TD BAKUGAN"
            title="Sàn đấu giá đang mở"
            description="Cơ hội sở hữu hàng hiếm với mức giá do chính cộng đồng quyết định. Đặt giá trực tiếp, theo dõi realtime."
            action={<ViewAllLink to={ROUTES.auctions} label="Vào sàn đấu giá" />}
          />

          {auctions.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <AuctionCardSkeleton key={index} />
              ))}
            </div>
          ) : highlightAuctions.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlightAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/12 bg-surface/50 px-6 py-12 text-center text-sm text-text-muted">
              Hiện chưa có phiên nào đang mở. Theo dõi trang Đấu giá để nhận thông báo phiên mới.
            </p>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Gavel,
                title: 'Đặt giá minh bạch',
                text: 'Lịch sử đặt giá công khai, tên người đặt được ẩn một phần.',
              },
              {
                icon: Sparkles,
                title: 'Hàng hiếm độc quyền',
                text: 'Những món không bán lẻ chỉ xuất hiện trên sàn đấu giá.',
              },
              {
                icon: Flame,
                title: 'Cập nhật realtime',
                text: 'Giá và lượt đặt cập nhật ngay, có cảnh báo khi bạn bị vượt giá.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-surface/60 p-4"
              >
                <item.icon
                  size={18}
                  className="mt-0.5 shrink-0 text-accent-pink"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-text">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Bán chạy */}
      <section className="py-12 sm:py-16">
        <Container>
          <SectionHeading
            eyebrow="BÁN CHẠY NHẤT"
            title="Cộng đồng chọn nhiều nhất"
            description="Xếp theo số lượng đã bán trong toàn bộ thời gian hoạt động của shop."
            action={
              <ViewAllLink to={`${ROUTES.products}?sort=best-selling`} label="Xem bảng xếp hạng" />
            }
          />

          {bestSellers.isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {bestSellers.data?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <SeriesGrid />

      {/* Nổi bật */}
      <section className="py-12 sm:py-16">
        <Container>
          <SectionHeading
            eyebrow="SHOP ĐỀ CỬ"
            title="Đáng sưu tầm tháng này"
            description="Những món được đội ngũ TD Bakugan đánh giá cao về độ hoàn thiện và độ hiếm."
          />
          {featured.isLoading ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.data?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <Commitments />

      {/* Blog */}
      <section className="py-12 sm:py-16">
        <Container>
          <SectionHeading
            eyebrow="GÓC KIẾN THỨC"
            title="Bài viết mới nhất"
            description="Hướng dẫn phân biệt hàng thật, mẹo bảo quản và kinh nghiệm đấu giá."
            action={<ViewAllLink to={ROUTES.blog} label="Đọc tất cả bài viết" />}
          />

          {posts.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <BlogCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.data?.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

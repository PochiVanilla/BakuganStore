import { Link } from 'react-router-dom';
import { Home, Search, Gavel } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Container, Seo } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <>
      <Seo
        title="Không tìm thấy trang"
        description="Trang bạn tìm không tồn tại hoặc đã được chuyển đi."
        noIndex
      />

      <Container className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-8" aria-hidden="true">
          <div className="absolute inset-0 animate-pulse-glow rounded-full blur-2xl" />
          <p className="relative font-display text-[7rem] leading-none font-black sm:text-[10rem]">
            <span className="text-gradient-neon">4</span>
            <span className="relative inline-block">
              <span className="text-gold neon-text-gold">0</span>
              <span className="absolute -top-2 -right-2 h-4 w-4 animate-twinkle rounded-full bg-accent-cyan shadow-[0_0_14px_#3FE3F5]" />
            </span>
            <span className="text-gradient-neon">4</span>
          </p>
        </div>

        <h1 className="font-display text-2xl font-extrabold text-text sm:text-3xl">
          Quả cầu này đã lăn mất rồi!
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted sm:text-base">
          Trang bạn tìm không tồn tại hoặc đã được chuyển sang địa chỉ khác. Thử quay về trang chủ
          hoặc khám phá bộ sưu tập nhé.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={ROUTES.home}
            className="inline-flex h-12 items-center gap-2 rounded-xl gradient-cta px-6 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Home size={17} aria-hidden="true" />
            Về trang chủ
          </Link>
          <Link
            to={ROUTES.products}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-accent-cyan/50 bg-accent-cyan/5 px-6 text-sm font-semibold text-accent-cyan transition hover:bg-accent-cyan/15"
          >
            <Search size={17} aria-hidden="true" />
            Xem sản phẩm
          </Link>
          <Link
            to={ROUTES.auctions}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-6 text-sm font-semibold text-text-muted transition hover:border-accent-pink/50 hover:text-accent-pink"
          >
            <Gavel size={17} aria-hidden="true" />
            Sàn đấu giá
          </Link>
        </div>
      </Container>
    </>
  );
}

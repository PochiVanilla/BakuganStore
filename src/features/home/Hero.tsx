import { Link } from 'react-router-dom';
import { ArrowRight, Gavel, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { ROUTES } from '@/constants/routes';
import { Container } from '@/components/ui';
import { GalaxyDragonOrb } from './GalaxyDragonOrb';
import { formatNumber } from '@/utils/format';

const STATS = [
  { value: '2.400+', label: 'Đơn hàng đã giao' },
  { value: '150+', label: 'Mẫu Bakugan' },
  { value: '4,9/5', label: 'Đánh giá trung bình' },
];

export function Hero({
  productCount,
  liveAuctions,
}: {
  productCount: number;
  liveAuctions: number;
}) {
  return (
    <section className="relative overflow-hidden pt-10 pb-16 sm:pt-14 sm:pb-20">
      {/* Mặt trăng khuyết vàng */}
      <div
        className="pointer-events-none absolute top-0 -right-20 h-72 w-72 rounded-full bg-gold/15 blur-3xl sm:h-96 sm:w-96"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-32 -left-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />

      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-3.5 py-1.5 text-xs font-semibold text-accent-cyan">
              <Sparkles size={13} aria-hidden="true" />
              {liveAuctions > 0
                ? `${liveAuctions} phiên đấu giá đang diễn ra`
                : 'Sàn đấu giá mở mỗi tuần'}
            </span>

            <h1 className="mt-5 font-display text-4xl leading-[1.1] font-black sm:text-5xl lg:text-6xl">
              <span className="text-gradient-neon">TRẬN ĐẤU</span>
              <br />
              <span className="text-text">BẮT ĐẦU TỪ</span>{' '}
              <span className="text-gold neon-text-gold">ĐÊM NAY</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">
              Hơn {formatNumber(productCount)} mẫu Bakugan chính hãng, hàng sưu tầm hiếm và sàn đấu
              giá dành riêng cho cộng đồng người chơi Việt Nam. Kiểm tra kỹ từng sản phẩm, đóng gói
              chống sốc, giao nhanh toàn quốc.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={ROUTES.products}
                className="inline-flex h-13 items-center gap-2.5 rounded-xl gradient-cta px-7 font-display text-sm font-bold text-white transition hover:shadow-glow-pink hover:brightness-110"
              >
                <Zap size={18} aria-hidden="true" />
                Khám phá bộ sưu tập
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                to={ROUTES.auctions}
                className="inline-flex h-13 items-center gap-2.5 rounded-xl border border-accent-cyan/50 bg-accent-cyan/5 px-7 font-display text-sm font-bold text-accent-cyan transition hover:bg-accent-cyan/15 hover:shadow-glow-cyan"
              >
                <Gavel size={18} aria-hidden="true" />
                Vào sàn đấu giá
              </Link>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-extrabold text-text">
                      {stat.value}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* Quả cầu Bakugan galaxy có rồng neon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            className="relative mx-auto aspect-square w-full max-w-sm lg:max-w-md"
          >
            <div className="h-full w-full animate-float">
              <GalaxyDragonOrb />
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

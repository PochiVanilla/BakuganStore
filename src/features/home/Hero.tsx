import { Link } from 'react-router-dom';
import { ArrowRight, Gavel, MessagesSquare, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FeedPost } from '@/types';
import { ROUTES } from '@/constants/routes';
import { CONSULT_STARTER } from '@/constants/chat';
import { formatNumber, formatTime } from '@/utils/format';
import { useUIStore } from '@/store/uiStore';
import { Container, FeedCardSkeleton } from '@/components/ui';
import { FeedCard } from '@/features/feed/FeedCard';

export function Hero({
  latestFeed,
  isLoading,
  availableCount,
  feedCount,
  liveAuctions,
}: {
  latestFeed?: FeedPost;
  isLoading: boolean;
  availableCount: number;
  feedCount: number;
  liveAuctions: number;
}) {
  const openChat = useUIStore((state) => state.openChat);

  const eyebrow =
    latestFeed?.status === 'upcoming'
      ? `Feed #${latestFeed.number} mở bán lúc ${formatTime(latestFeed.opensAt)}`
      : liveAuctions > 0
        ? `${liveAuctions} phiên đấu giá đang diễn ra`
        : 'Feed mới lên mỗi tuần';

  const stats = [
    { value: formatNumber(availableCount), label: 'Con đang bán' },
    { value: formatNumber(feedCount), label: 'Feed trên web' },
    { value: formatNumber(liveAuctions), label: 'Phiên đấu giá mở' },
  ];

  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pt-14 sm:pb-20">
      <div
        className="pointer-events-none absolute top-0 -right-20 h-72 w-72 rounded-full bg-gold/12 blur-3xl sm:h-96 sm:w-96"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-32 -left-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />

      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-3.5 py-1.5 text-xs font-semibold text-accent-cyan">
              <Sparkles size={13} aria-hidden="true" />
              {eyebrow}
            </span>

            <h1 className="mt-5 font-display text-4xl leading-[1.1] font-black sm:text-5xl lg:text-6xl">
              <span className="text-gradient-neon">TRẬN ĐẤU</span>
              <br />
              <span className="text-text">BẮT ĐẦU TỪ</span>{' '}
              <span className="text-gold neon-text-gold">ĐÊM NAY</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">
              Mỗi tuần TD Bakugan đăng feed mới theo lô: ảnh thật cả lô, mỗi con một mã riêng, con
              nào có người chốt là hiện SOLD. Thành viên Lv2 được vào sàn đấu giá hàng hiếm.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={latestFeed ? ROUTES.feedDetail(latestFeed.number) : ROUTES.feeds}
                className="inline-flex h-13 items-center gap-2.5 rounded-xl gradient-cta px-6 font-display text-sm font-bold text-white transition hover:shadow-glow-pink hover:brightness-110"
              >
                Xem feed mới nhất
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => openChat({ send: CONSULT_STARTER })}
                className="inline-flex h-13 items-center gap-2.5 rounded-xl border border-accent-cyan/50 bg-accent-cyan/5 px-6 font-display text-sm font-bold text-accent-cyan transition hover:bg-accent-cyan/15 hover:shadow-glow-cyan"
              >
                <MessagesSquare size={17} aria-hidden="true" />
                Tư vấn chọn Bakugan
              </button>
            </div>
            <Link
              to={ROUTES.auctions}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-gold"
            >
              <Gavel size={15} aria-hidden="true" />
              Vào sàn đấu giá
            </Link>

            <dl className="mt-8 grid max-w-md grid-cols-3 gap-4">
              {stats.map((stat) => (
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

          {/* Feed mới nhất thay cho hình minh hoạ: khách thấy ngay lô hàng sắp / đang bán. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
            className="relative"
          >
            <div
              className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br from-accent-cyan/20 via-primary/10 to-accent-pink/20 blur-2xl"
              aria-hidden="true"
            />
            {isLoading ? (
              <FeedCardSkeleton />
            ) : latestFeed ? (
              <FeedCard feed={latestFeed} priority className="relative" />
            ) : null}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

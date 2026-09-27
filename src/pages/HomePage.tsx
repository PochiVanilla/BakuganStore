import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  EyeOff,
  Gavel,
  MessagesSquare,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { CONSULT_STARTER } from '@/constants/chat';
import { HOME_FEED_LIMIT, PURCHASES_FOR_LV2 } from '@/constants/catalog';
import { fetchFeeds } from '@/services/api/feedService';
import { fetchAuctions } from '@/services/api/auctionService';
import { fetchLatestPosts } from '@/services/api/blogService';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useUIStore } from '@/store/uiStore';
import {
  AuctionCardSkeleton,
  BlogCardSkeleton,
  Container,
  FeedCardSkeleton,
  SectionHeading,
  Seo,
} from '@/components/ui';
import { FeedCard } from '@/features/feed/FeedCard';
import { AuctionCard } from '@/features/auction/AuctionCard';
import { BlogCard } from '@/features/blog/BlogCard';
import { Hero } from '@/features/home/Hero';
import { AttributeGrid } from '@/features/home/CategoryGrid';
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

const AUCTION_POINTS = [
  {
    icon: EyeOff,
    title: 'Không lộ người đặt',
    text: 'Chỉ công khai giá cao nhất và số người đã đặt — không ai biết ai đang đấu với mình.',
  },
  {
    icon: ShieldCheck,
    title: 'Dành cho thành viên Lv2',
    text: 'Chỉ thành viên Lv2 trở lên được đặt giá, hạn chế tài khoản ảo phá giá.',
  },
  {
    icon: Radio,
    title: 'Cập nhật realtime',
    text: 'Giá mới hiện ngay, có cảnh báo khi bạn bị vượt và luật chống bắn tỉa phút chót.',
  },
];

const LEVEL_UP_WAYS = [
  { icon: ShoppingBag, text: `Mua đủ ${PURCHASES_FOR_LV2} Bakugan ở TD shop (tự lên hạng)` },
  { icon: Wallet, text: 'Hoặc nạp số tiền thành viên theo quy định của shop' },
  { icon: ShieldCheck, text: 'Hoặc gửi yêu cầu để admin xét duyệt' },
];

export default function HomePage() {
  const revision = useLiveRevision();
  const openChat = useUIStore((state) => state.openChat);
  // Lấy cả danh sách (tối đa 30 feed) để đếm đúng số liệu; trang chủ chỉ hiện 10 feed mới nhất.
  const feeds = useAsync(() => fetchFeeds(), [revision], { keepPreviousData: true });
  const auctions = useAsync(() => fetchAuctions(), []);
  const posts = useAsync(() => fetchLatestPosts(3), []);

  const allFeeds = feeds.data ?? [];
  const [latestFeed, ...otherFeeds] = allFeeds.slice(0, HOME_FEED_LIMIT);
  const liveAuctions = (auctions.data ?? []).filter((auction) => auction.status === 'live');
  const upcomingAuctions = (auctions.data ?? []).filter((auction) => auction.status === 'upcoming');
  const highlightAuctions = [...liveAuctions, ...upcomingAuctions].slice(0, 3);
  const availableCount = allFeeds.reduce(
    (sum, feed) => sum + (feed.status === 'upcoming' ? 0 : feed.itemCount - feed.soldCount),
    0,
  );

  return (
    <>
      <Seo
        title="TD Bakugan"
        description="Shop Bakugan chính hãng tại Việt Nam: feed bán theo lô mỗi tuần, ảnh thật cả lô, mỗi con một mã riêng. Sàn đấu giá cho thành viên Lv2. Giao nhanh toàn quốc, đổi trả 7 ngày."
        path={ROUTES.home}
      />

      <Hero
        latestFeed={latestFeed}
        isLoading={feeds.isLoading && !feeds.data}
        availableCount={availableCount}
        feedCount={allFeeds.length}
        liveAuctions={liveAuctions.length}
      />

      {/* Feed bán — tối đa 10 feed trên trang chủ (1 ở trên + 9 ở đây) */}
      <section className="py-12 sm:py-16" aria-labelledby="home-feeds">
        <Container>
          <SectionHeading
            eyebrow="FEED BÁN"
            title="Các feed gần đây"
            description="Mỗi feed là một lô shop vừa nhập. Con nào đã có người chốt sẽ hiện SOLD."
            action={<ViewAllLink to={ROUTES.feeds} label="Xem tất cả feed" />}
          />
          <h2 id="home-feeds" className="sr-only">
            Các feed gần đây
          </h2>

          {feeds.isLoading && !feeds.data ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <FeedCardSkeleton key={index} />
              ))}
            </div>
          ) : otherFeeds.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {otherFeeds.map((feed) => (
                <FeedCard key={feed.id} feed={feed} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/12 bg-surface/50 px-6 py-12 text-center text-sm text-text-muted">
              Chưa có feed nào khác. Feed mới lên mỗi tuần, quay lại sớm nhé!
            </p>
          )}
        </Container>
      </section>

      {/* Tư vấn cho người mới */}
      <section className="py-6 sm:py-10">
        <Container>
          <div className="relative overflow-hidden rounded-3xl border border-accent-cyan/25 bg-gradient-to-br from-accent-cyan/10 via-surface/80 to-primary/15 p-6 sm:p-10">
            <div
              className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-accent-pink/20 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="font-display text-xs font-bold tracking-[0.3em] text-accent-cyan">
                  MỚI CHƠI BAKUGAN?
                </p>
                <h2 className="mt-2 font-display text-2xl font-black text-text sm:text-3xl">
                  Để trợ lý AI chọn giúp bạn
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
                  Trả lời 4 câu ngắn — mua để chơi hay sưu tầm, thích hệ nào, ngân sách bao nhiêu,
                  muốn hàng mới hay đã qua sử dụng — trợ lý sẽ gợi ý những con đang bán hợp với bạn
                  nhất, kèm lý do.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openChat({ send: CONSULT_STARTER })}
                className="inline-flex h-13 items-center justify-center gap-2.5 rounded-xl gradient-cta px-7 font-display text-sm font-bold text-white transition hover:shadow-glow-pink hover:brightness-110"
              >
                <MessagesSquare size={18} aria-hidden="true" />
                Bắt đầu tư vấn
              </button>
            </div>
          </div>
        </Container>
      </section>

      <AttributeGrid />

      {/* Đấu giá */}
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
            eyebrow="ĐẶC QUYỀN THÀNH VIÊN LV2"
            title="Sàn đấu giá đang mở"
            description="Hàng hiếm không bán trên feed, giá do chính cộng đồng quyết định."
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
            {AUCTION_POINTS.map((item) => (
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

          <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/5 p-5">
            <p className="inline-flex items-center gap-2 font-display text-sm font-bold text-gold">
              <Gavel size={16} aria-hidden="true" />
              Cách lên thành viên Lv2 để đấu giá
            </p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {LEVEL_UP_WAYS.map((way) => (
                <li key={way.text} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <way.icon size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                  {way.text}
                </li>
              ))}
            </ul>
            <Link
              to={ROUTES.membership}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline"
            >
              Xem hạng của bạn
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
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

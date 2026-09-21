import { Link } from 'react-router-dom';
import { Gavel, Eye, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Auction } from '@/types';
import { ROUTES } from '@/constants/routes';
import { AUCTION_STATUS_LABELS, CONDITION_LABELS } from '@/constants/catalog';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { AttributeBadge, Countdown } from '@/components/ui';

const STATUS_STYLES = {
  live: 'border-danger/50 bg-danger/15 text-danger',
  upcoming: 'border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan',
  ended: 'border-white/15 bg-white/5 text-text-muted',
} as const;

export function AuctionCard({ auction }: { auction: Auction }) {
  const isLive = auction.status === 'live';
  const isUpcoming = auction.status === 'upcoming';

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border bg-surface/80 transition-colors duration-300',
        isLive
          ? 'border-accent-pink/30 hover:border-accent-pink/60 hover:shadow-[0_18px_44px_-20px_rgba(233,64,210,0.8)]'
          : 'border-white/8 hover:border-accent-cyan/40',
      )}
    >
      <div className="relative overflow-hidden bg-surface-2">
        <Link to={ROUTES.auctionDetail(auction.id)} aria-label={auction.title}>
          <img
            src={auction.images[0]}
            alt={auction.title}
            loading="lazy"
            decoding="async"
            width={600}
            height={450}
            className={cn(
              'aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-110',
              auction.status === 'ended' && 'opacity-55 grayscale',
            )}
          />
        </Link>

        <span
          className={cn(
            'absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-display text-[10px] font-bold tracking-wider',
            STATUS_STYLES[auction.status],
          )}
        >
          {isLive && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
          )}
          {AUCTION_STATUS_LABELS[auction.status].toUpperCase()}
        </span>

        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-background/75 px-2 py-1 text-[11px] font-medium text-text-muted backdrop-blur">
          <Eye size={12} aria-hidden="true" />
          {formatNumber(auction.watcherCount)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <AttributeBadge attribute={auction.attribute} size="sm" />
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
            <Zap size={12} aria-hidden="true" />
            {formatNumber(auction.gPower)}G
          </span>
        </div>

        <Link to={ROUTES.auctionDetail(auction.id)}>
          <h3 className="line-clamp-2 font-display text-sm leading-snug font-bold text-text transition-colors group-hover:text-accent-cyan">
            {auction.title}
          </h3>
        </Link>

        <p className="mt-1.5 text-xs text-text-muted">{CONDITION_LABELS[auction.condition]}</p>

        <div className="mt-3.5 rounded-xl border border-white/8 bg-surface-2/70 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-text-muted">
              {auction.status === 'ended' ? 'Giá chốt' : 'Giá hiện tại'}
            </span>
            <span className="font-display text-lg font-extrabold text-gold neon-text-gold">
              {formatCurrency(auction.currentPrice)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Gavel size={11} aria-hidden="true" />
              {auction.bidCount} lượt đặt
            </span>
            <span>Bước giá {formatCurrency(auction.bidStep)}</span>
          </div>
        </div>

        <div className="mt-3.5">
          {isUpcoming ? (
            <div className="text-center">
              <p className="mb-1.5 text-[11px] tracking-wider text-text-muted uppercase">
                Mở phiên sau
              </p>
              <Countdown targetIso={auction.startAt} size="sm" className="justify-center" />
              <p className="mt-2 text-[11px] text-text-muted">{formatDateTime(auction.startAt)}</p>
            </div>
          ) : isLive ? (
            <div className="text-center">
              <p className="mb-1.5 text-[11px] tracking-wider text-text-muted uppercase">
                Kết thúc sau
              </p>
              <Countdown targetIso={auction.endAt} size="sm" className="justify-center" />
            </div>
          ) : (
            <p className="text-center text-xs text-text-muted">
              Người thắng:{' '}
              <span className="font-semibold text-text">
                {auction.winnerMaskedName ?? 'Không có lượt đặt'}
              </span>
            </p>
          )}
        </div>

        <Link
          to={ROUTES.auctionDetail(auction.id)}
          className={cn(
            'mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
            isLive
              ? 'gradient-cta text-white hover:shadow-glow-pink hover:brightness-110'
              : 'border border-accent-cyan/40 bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/15',
          )}
        >
          <Gavel size={16} />
          {isLive ? 'Đặt giá ngay' : isUpcoming ? 'Xem chi tiết' : 'Xem kết quả'}
        </Link>
      </div>
    </motion.article>
  );
}

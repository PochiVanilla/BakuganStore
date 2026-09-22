import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, LockKeyhole, TriangleAlert } from 'lucide-react';
import type { Auction } from '@/types';
import { ROUTES } from '@/constants/routes';
import { getMinimumBid, isInAntiSnipeWindow, placeBid } from '@/services/api/auctionService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui';
import { AntiSnipeBanner } from './AuctionRules';
import { minimumBidHint } from './auctionRuleText';

interface BidFormProps {
  auction: Auction;
  onBidPlaced: (auction: Auction) => void;
  /** true khi có người khác vừa vượt giá của bạn */
  isOutbid: boolean;
}

export function BidForm({ auction, onBidPlaced, isOutbid }: BidFormProps) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const minimumBid = getMinimumBid(auction, user?.id);
  const [amount, setAmount] = useState<number>(minimumBid);
  const [trackedMinimum, setTrackedMinimum] = useState(minimumBid);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Có người khác vừa đặt giá -> nâng ô nhập lên mức tối thiểu mới ngay khi
  // render (cách React khuyến nghị thay cho setState trong useEffect).
  if (trackedMinimum !== minimumBid) {
    setTrackedMinimum(minimumBid);
    if (amount < minimumBid) setAmount(minimumBid);
  }

  if (auction.status === 'ended') {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface-2/60 p-5 text-center">
        <p className="font-display text-sm font-bold text-text">Phiên đã kết thúc</p>
        <p className="mt-1.5 text-sm text-text-muted">
          Người thắng:{' '}
          <span className="font-semibold text-gold">
            {auction.winnerMaskedName ?? 'Không có lượt đặt nào'}
          </span>
        </p>
      </div>
    );
  }

  if (auction.status === 'upcoming') {
    return (
      <div className="rounded-2xl border border-accent-cyan/25 bg-accent-cyan/8 p-5 text-center">
        <p className="font-display text-sm font-bold text-accent-cyan">Phiên chưa bắt đầu</p>
        <p className="mt-1.5 text-sm text-text-muted">
          Giá khởi điểm {formatCurrency(auction.startPrice)}. Quay lại khi đồng hồ đếm ngược kết
          thúc để đặt giá.
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-gold/8 p-5">
        <p className="inline-flex items-center gap-2 font-display text-sm font-bold text-gold">
          <LockKeyhole size={15} aria-hidden="true" />
          Cần đăng nhập để đặt giá
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Đăng nhập để tham gia phiên này. Lượt đặt giá của bạn sẽ được ghi nhận ngay lập tức.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            to={ROUTES.login}
            className="inline-flex h-11 items-center rounded-xl gradient-cta px-5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Đăng nhập
          </Link>
          <Link
            to={ROUTES.register}
            className="inline-flex h-11 items-center rounded-xl border border-white/15 bg-surface-2 px-5 text-sm font-semibold text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
          >
            Đăng ký tài khoản
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(amount) || amount < minimumBid) {
      setError(`Giá đặt phải từ ${formatCurrency(minimumBid)} trở lên.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await placeBid({
        auctionId: auction.id,
        amount,
        bidderId: user.id,
        bidderName: user.fullName,
      });
      onBidPlaced(updated);
      toast.success('Đặt giá thành công!', `Bạn đang dẫn đầu với ${formatCurrency(amount)}.`);
    } catch (submitError) {
      const message = getApiErrorMessage(submitError);
      setError(message);
      toast.error('Đặt giá thất bại', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [minimumBid, minimumBid + auction.bidStep, minimumBid + auction.bidStep * 3];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-surface-2/60 p-5"
    >
      {isOutbid && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          Bạn vừa bị vượt giá! Đặt mức cao hơn để giành lại vị trí dẫn đầu.
        </p>
      )}

      {isInAntiSnipeWindow(auction) && (
        <div className="mb-4">
          <AntiSnipeBanner auction={auction} />
        </div>
      )}

      <label htmlFor="bid-amount" className="block font-display text-sm font-bold text-text">
        Mức giá bạn muốn đặt
      </label>
      <p className="mt-1 text-xs text-text-muted">{minimumBidHint(auction, minimumBid)}</p>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-background/60 px-4 focus-within:border-accent-cyan focus-within:shadow-[0_0_0_3px_rgba(63,227,245,0.14)]">
        <input
          id="bid-amount"
          type="number"
          inputMode="numeric"
          min={minimumBid}
          step={auction.bidStep}
          value={Number.isFinite(amount) ? amount : ''}
          onChange={(event) => setAmount(Number(event.target.value))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'bid-error' : 'bid-hint'}
          className="h-13 min-w-0 flex-1 bg-transparent font-display text-lg font-bold text-gold tabular-nums outline-none"
        />
        <span className="font-display text-lg font-bold text-gold" aria-hidden="true">
          ₫
        </span>
      </div>

      <p id="bid-hint" className="sr-only">
        Nhập số tiền tối thiểu {minimumBid} đồng
      </p>

      {error && (
        <p id="bid-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {auction.priceVisibility === 'open' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickAmounts.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setAmount(value);
                setError(null);
              }}
              className="rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
            >
              {formatCurrency(value)}
            </button>
          ))}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={isSubmitting}
        leftIcon={<Gavel size={18} />}
        className="mt-4"
      >
        {isSubmitting ? 'Đang gửi lượt đặt…' : 'Đặt giá'}
      </Button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-text-muted">
        Bằng việc đặt giá, bạn cam kết mua sản phẩm nếu thắng phiên và thanh toán trong 48 giờ.
        {auction.antiSnipeMinutes > 0 &&
          ` Đặt trong ${auction.antiSnipeMinutes} phút cuối sẽ gia hạn phiên thêm ${auction.antiSnipeMinutes} phút.`}
      </p>
    </form>
  );
}

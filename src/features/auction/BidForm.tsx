import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, LockKeyhole, ShieldCheck, ShoppingBag, TriangleAlert, Wallet } from 'lucide-react';
import type { Auction } from '@/types';
import { ROUTES } from '@/constants/routes';
import { AUCTION_MIN_LEVEL } from '@/constants/catalog';
import { getMinimumBid, isInAntiSnipeWindow, placeBid } from '@/services/api/auctionService';
import { fetchMyMembership } from '@/services/api/membershipService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
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
  const revision = useLiveRevision();
  const isCustomer = isAuthenticated && user?.role === 'customer';
  const membership = useAsync(() => fetchMyMembership(), [user?.id, revision], {
    enabled: isCustomer && auction.status === 'live',
    keepPreviousData: true,
  });

  const minimumBid = getMinimumBid(auction);
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
          {auction.viewerIsLeading ? (
            <span className="font-semibold text-success">
              Bạn đã thắng phiên này — shop sẽ liên hệ trong 24 giờ.
            </span>
          ) : auction.bidCount > 0 ? (
            'Phiên đã có người thắng. Tên người thắng không được công khai.'
          ) : (
            'Không có lượt đặt nào.'
          )}
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

  if (user.role !== 'customer') {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface-2/60 p-5 text-sm text-text-muted">
        Tài khoản quản trị không tham gia đặt giá. Xem người đặt ở trang quản trị → Đơn đấu giá.
      </div>
    );
  }

  const info = membership.data;
  if (info && info.level < AUCTION_MIN_LEVEL) {
    const left = Math.max(0, info.purchaseGoal - info.purchasedCount);
    return (
      <div className="rounded-2xl border border-gold/30 bg-gold/8 p-5">
        <p className="inline-flex items-center gap-2 font-display text-sm font-bold text-gold">
          <LockKeyhole size={15} aria-hidden="true" />
          Chỉ thành viên Lv{AUCTION_MIN_LEVEL} trở lên được đặt giá
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Bạn đang là thành viên Lv{info.level}. Lên Lv{AUCTION_MIN_LEVEL} bằng một trong ba cách:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          <li className="flex items-start gap-2">
            <ShoppingBag size={15} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <span>
              Mua đủ {info.purchaseGoal} Bakugan ở TD shop — bạn đã nhận{' '}
              <strong className="text-text">
                {info.purchasedCount}/{info.purchaseGoal}
              </strong>
              {left > 0 ? `, còn ${left} con nữa.` : '.'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Wallet size={15} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <span>Nạp {formatCurrency(info.depositAmount)} tiền thành viên.</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <span>Gửi yêu cầu để admin xét duyệt.</span>
          </li>
        </ul>
        {info.pendingRequest && (
          <p className="mt-3 rounded-lg border border-accent-cyan/30 bg-accent-cyan/8 px-3 py-2 text-xs text-accent-cyan">
            Yêu cầu lên Lv{AUCTION_MIN_LEVEL} của bạn đang chờ shop duyệt.
          </p>
        )}
        <Link
          to={ROUTES.membership}
          className="mt-4 inline-flex h-11 items-center rounded-xl gradient-cta px-5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Lên Lv{AUCTION_MIN_LEVEL} ngay
        </Link>
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
      const updated = await placeBid({ auctionId: auction.id, amount });
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
        Tên bạn không hiện cho người khác — họ chỉ thấy giá cao nhất và số người đã đặt. Bằng việc
        đặt giá, bạn cam kết mua nếu thắng phiên và thanh toán trong 48 giờ.
        {auction.antiSnipeMinutes > 0 &&
          ` Đặt trong ${auction.antiSnipeMinutes} phút cuối sẽ gia hạn phiên thêm ${auction.antiSnipeMinutes} phút.`}
      </p>
    </form>
  );
}

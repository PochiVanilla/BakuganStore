import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Clock,
  Gavel,
  Landmark,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { AUCTION_MIN_LEVEL, LEVEL_SOURCE_LABELS } from '@/constants/catalog';
import {
  cancelMembershipRequest,
  fetchMyMembership,
  requestDepositUpgrade,
  requestLevelReview,
} from '@/services/api/membershipService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useAuthStore } from '@/store/authStore';
import { toast, useUIStore } from '@/store/uiStore';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, ButtonLink, Skeleton } from '@/components/ui';

function WayCard({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: typeof ShoppingBag;
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-white/8 bg-surface/70 p-5">
      <p className="flex items-center gap-2.5 font-display text-sm font-bold text-text">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/35 bg-gold/10 text-gold">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[10px] font-semibold tracking-widest text-text-muted">
            CÁCH {step}
          </span>
          {title}
        </span>
      </p>
      <div className="mt-3 text-sm text-text-muted">{children}</div>
    </li>
  );
}

/** Hạng thành viên: Lv2 trở lên mới được đặt giá ở sàn đấu giá. */
export function MembershipTab() {
  const userId = useAuthStore((state) => state.user?.id);
  const revision = useLiveRevision();
  const openChat = useUIStore((state) => state.openChat);
  const {
    data: info,
    isLoading,
    reload,
  } = useAsync(() => fetchMyMembership(), [userId, revision], {
    enabled: Boolean(userId),
    keepPreviousData: true,
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'review' | 'cancel' | null>(null);

  if (isLoading && !info) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (!info) return null;

  const run = async (kind: 'deposit' | 'review' | 'cancel', task: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await task();
      reload();
      if (kind === 'deposit') {
        toast.success('Đã gửi yêu cầu', 'Shop đối soát tiền về rồi sẽ nâng bạn lên Lv2.');
      } else if (kind === 'review') {
        setMessage('');
        toast.success('Đã gửi yêu cầu', 'Admin sẽ xem và phản hồi sớm.');
      } else {
        toast.info('Đã rút lại yêu cầu');
      }
    } catch (error) {
      toast.error('Chưa gửi được', getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const isMember = info.level >= AUCTION_MIN_LEVEL;
  const percent = Math.min(100, Math.round((info.purchasedCount / info.purchaseGoal) * 100));
  const pending = info.pendingRequest;

  return (
    <section>
      <h2 className="font-display text-lg font-bold text-text">Hạng thành viên</h2>
      <p className="mt-1.5 text-sm text-text-muted">
        Thành viên Lv{AUCTION_MIN_LEVEL} trở lên mới được đặt giá ở sàn đấu giá.
      </p>

      <div
        className={cn(
          'mt-6 flex flex-wrap items-center gap-5 rounded-2xl border p-5',
          isMember ? 'border-gold/40 bg-gold/8' : 'border-white/10 bg-surface/70',
        )}
      >
        <span
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 font-display text-2xl font-black',
            isMember ? 'border-gold text-gold shadow-glow-gold' : 'border-white/20 text-text-muted',
          )}
        >
          Lv{info.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-text">Thành viên Lv{info.level}</p>
          {isMember ? (
            <p className="mt-1 text-sm text-text-muted">
              {info.source ? LEVEL_SOURCE_LABELS[info.source] : 'Đã lên hạng'}
              {info.levelUpAt && ` · từ ${formatDate(info.levelUpAt)}`}. Bạn được tham gia mọi phiên
              đấu giá.
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-muted">
              Chọn một trong ba cách bên dưới để lên Lv{AUCTION_MIN_LEVEL} và vào sàn đấu giá.
            </p>
          )}
          {info.depositBalance > 0 && (
            <p className="mt-1 text-xs text-gold">
              Tiền thành viên đã nạp: {formatCurrency(info.depositBalance)}
            </p>
          )}
        </div>
        {isMember && (
          <ButtonLink to={ROUTES.auctions} leftIcon={<Gavel size={16} />}>
            Vào sàn đấu giá
          </ButtonLink>
        )}
      </div>

      {pending && !isMember && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-accent-cyan/35 bg-accent-cyan/8 p-4 text-sm">
          <Clock size={17} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-accent-cyan">
              {pending.kind === 'deposit'
                ? `Đang chờ shop xác nhận khoản nạp ${formatCurrency(pending.amount ?? 0)}`
                : 'Đang chờ admin xét duyệt'}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Gửi lúc {formatDateTime(pending.createdAt)}. Duyệt xong bạn lên Lv
              {AUCTION_MIN_LEVEL} ngay.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            isLoading={busy === 'cancel'}
            onClick={() => void run('cancel', cancelMembershipRequest)}
          >
            Rút lại
          </Button>
        </div>
      )}

      {!isMember && (
        <ol className="mt-6 grid gap-4 xl:grid-cols-3">
          <WayCard icon={ShoppingBag} step={1} title={`Mua ${info.purchaseGoal} Bakugan`}>
            <p>
              Nhận đủ {info.purchaseGoal} con mua ở TD shop (đơn đã giao thành công) là tự lên hạng.
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs">
                <span>Đã nhận</span>
                <span className="font-semibold text-text tabular-nums">
                  {info.purchasedCount}/{info.purchaseGoal}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8"
                role="progressbar"
                aria-label="Số Bakugan đã nhận"
                aria-valuemin={0}
                aria-valuemax={info.purchaseGoal}
                aria-valuenow={info.purchasedCount}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-accent-pink"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <Link
              to={ROUTES.feeds}
              className="mt-3 inline-block text-xs font-semibold text-accent-cyan hover:underline"
            >
              Xem feed đang bán →
            </Link>
          </WayCard>

          <WayCard icon={Wallet} step={2} title={`Nạp ${formatCurrency(info.depositAmount)}`}>
            {info.bank ? (
              <dl className="space-y-1 rounded-xl border border-white/8 bg-background/40 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-text">
                  <Landmark size={13} aria-hidden="true" />
                  {info.bank.bankName}
                </div>
                <div>
                  STK:{' '}
                  <span className="font-mono font-semibold text-text">
                    {info.bank.accountNumber}
                  </span>
                </div>
                <div>Chủ TK: {info.bank.accountHolder}</div>
                <div>
                  Nội dung:{' '}
                  <span className="font-mono font-semibold text-gold">{info.transferNote}</span>
                </div>
              </dl>
            ) : (
              <p className="text-xs">
                Nhắn shop để nhận số tài khoản, ghi nội dung{' '}
                <span className="font-mono font-semibold text-gold">{info.transferNote}</span>.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {info.bank ? (
                <Button
                  size="sm"
                  isLoading={busy === 'deposit'}
                  disabled={Boolean(pending)}
                  onClick={() => void run('deposit', () => requestDepositUpgrade())}
                >
                  Tôi đã chuyển khoản
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<MessageCircle size={15} />}
                  onClick={() =>
                    openChat({
                      prefill: `Mình muốn nạp ${formatCurrency(info.depositAmount)} để lên Lv2, nội dung ${info.transferNote}. `,
                    })
                  }
                >
                  Nhắn shop
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px]">
              Shop đối soát sao kê rồi xác nhận, thường trong ngày.
            </p>
          </WayCard>

          <WayCard icon={ShieldCheck} step={3} title="Nhờ admin duyệt">
            <p>Khách quen, mua trực tiếp tại shop hay qua Messenger — kể cho shop biết nhé.</p>
            <label className="mt-3 block">
              <span className="sr-only">Lời nhắn cho admin</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="VD: Mình đã mua 4 con ở shop Q6, tên Zalo là…"
                className="w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent-cyan"
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              isLoading={busy === 'review'}
              disabled={Boolean(pending) || message.trim().length < 10}
              onClick={() => void run('review', () => requestLevelReview(message))}
            >
              Gửi yêu cầu
            </Button>
          </WayCard>
        </ol>
      )}

      {isMember && (
        <p className="mt-6 inline-flex items-start gap-2 text-sm text-text-muted">
          <BadgeCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
          Khi đặt giá, tên bạn không hiện cho người khác — sàn chỉ công khai giá cao nhất và số
          người đã đặt.
        </p>
      )}
    </section>
  );
}

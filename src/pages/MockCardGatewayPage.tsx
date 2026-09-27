import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Clock,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { CARD_BRAND_LABELS } from '@/constants/orders';
import {
  MOCK_OTP,
  MOCK_TEST_CARDS,
  mockGatewayAbort,
  mockGatewayConfirmOtp,
  mockGatewayPay,
  mockGatewaySession,
  type MockCardInput,
  type MockGatewayResult,
} from '@/services/api/paymentService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useCountdown } from '@/hooks/useCountdown';
import { detectCardBrand, formatCardNumber, formatExpiry } from '@/utils/card';
import { formatUsd, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

const EMPTY_CARD: MockCardInput = { number: '', expiry: '', cvc: '', holder: '' };

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20';

/** Thời hạn giả để gọi useCountdown khi chưa tải xong phiên. */
const FAR_FUTURE = '2999-01-01T00:00:00.000Z';

/**
 * Cổng thanh toán thẻ GIẢ LẬP — chỉ có ở bản chạy thử để thử trọn luồng trả thẻ.
 * Khi nối cổng thật (OnePay, VNPAY, 2C2P…), khách nhập thẻ trên trang của cổng, web của
 * shop không có trang này. Chỉ nhận thẻ thử, không lưu số thẻ ở đâu cả.
 */
export default function MockCardGatewayPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const session = useAsync(() => mockGatewaySession(orderId), [orderId]);
  const { minutes, seconds, isFinished } = useCountdown(session.data?.expiresAt ?? FAR_FUTURE);
  const [card, setCard] = useState<MockCardInput>(EMPTY_CARD);
  const [otpFor, setOtpFor] = useState<{ brand: string; last4: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const brand = detectCardBrand(card.number);
  const result = ROUTES.checkoutResult(orderId);

  if (session.data?.closed) return <Navigate to={result} replace />;

  const handle = (outcome: MockGatewayResult): void => {
    if (outcome.status === 'succeeded') {
      navigate(result, { replace: true });
    } else if (outcome.status === 'requires_otp') {
      setOtpFor({ brand: CARD_BRAND_LABELS[outcome.brand], last4: outcome.last4 });
      setOtp('');
    } else {
      setOtpFor(null);
      setError(outcome.message);
    }
  };

  const run = async (action: () => Promise<MockGatewayResult>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      handle(await action());
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  };

  const payCard = (event: FormEvent): void => {
    event.preventDefault();
    void run(() => mockGatewayPay(orderId, card));
  };

  const confirmOtp = (event: FormEvent): void => {
    event.preventDefault();
    void run(() => mockGatewayConfirmOtp(orderId, otp));
  };

  const backToShop = async (): Promise<void> => {
    setBusy(true);
    try {
      await mockGatewayAbort(orderId);
    } finally {
      navigate(result, { replace: true });
    }
  };

  const amount = session.data ? `${formatNumber(session.data.amount)} VND` : '…';

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-slate-100 font-sans text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <LockKeyhole size={16} className="text-emerald-600" aria-hidden="true" />
            Cổng thanh toán thẻ
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-800">
            GIẢ LẬP · TEST MODE
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5 pb-12">
        <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Đây là cổng giả lập để chạy thử web — <strong>không nhập thẻ thật</strong>, chỉ dùng các
            thẻ thử bên dưới. Khi nối cổng thanh toán thật, khách nhập thẻ trên trang của cổng.
          </span>
        </p>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Người bán</dt>
              <dd className="font-semibold text-slate-900">TD Bakugan</dd>
            </div>
            <div className="text-right">
              <dt className="text-xs text-slate-500">Đơn hàng</dt>
              <dd className="font-mono font-semibold text-slate-900">
                #{session.data?.orderCode ?? '…'}
              </dd>
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-3">
              <dt className="text-xs text-slate-500">Số tiền</dt>
              <dd className="text-2xl font-extrabold text-slate-900">
                {amount}
                {session.data && (
                  <span className="ml-2 inline-block text-sm font-medium whitespace-nowrap text-slate-500">
                    ≈ {formatUsd(session.data.amount, session.data.usdRate)}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {session.data && (
            <p
              role="timer"
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums',
                isFinished ? 'text-red-600' : 'text-slate-500',
              )}
            >
              <Clock size={13} aria-hidden="true" />
              {isFinished
                ? 'Phiên thanh toán đã hết hạn'
                : `Phiên hết hạn sau ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </p>
          )}
        </section>

        {session.error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {session.error}
          </p>
        )}

        <section className="relative mt-4 rounded-2xl bg-white p-5 shadow-sm">
          {busy && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/85 text-sm font-semibold text-slate-700">
              <LoaderCircle size={26} className="animate-spin text-sky-600" aria-hidden="true" />
              Đang xử lý giao dịch…
            </div>
          )}

          {otpFor ? (
            <form onSubmit={confirmOtp} noValidate>
              <h1 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ShieldCheck size={18} className="text-emerald-600" aria-hidden="true" />
                Xác thực 3-D Secure
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Ngân hàng đã gửi mã OTP tới số điện thoại đăng ký thẻ {otpFor.brand} ••••{' '}
                {otpFor.last4}. Thẻ thử dùng mã <strong className="font-mono">{MOCK_OTP}</strong>.
              </p>
              <label htmlFor="otp" className="mt-4 block text-xs font-semibold text-slate-600">
                Mã OTP
              </label>
              <input
                id="otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className={cn(inputClass, 'mt-1 font-mono tracking-[0.4em]')}
              />
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || otp.length < 6}
                className="mt-4 h-11 w-full rounded-lg bg-sky-700 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-50"
              >
                Xác nhận
              </button>
            </form>
          ) : (
            <form onSubmit={payCard} noValidate>
              <h1 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <CreditCard size={18} className="text-sky-700" aria-hidden="true" />
                Thông tin thẻ
              </h1>
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="card-number"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Số thẻ
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="card-number"
                      value={card.number}
                      onChange={(event) =>
                        setCard({ ...card, number: formatCardNumber(event.target.value) })
                      }
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="4242 4242 4242 4242"
                      className={cn(inputClass, 'pr-24 font-mono')}
                    />
                    {brand && (
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {CARD_BRAND_LABELS[brand]}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="card-holder"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Tên in trên thẻ
                  </label>
                  <input
                    id="card-holder"
                    value={card.holder}
                    onChange={(event) =>
                      setCard({ ...card, holder: event.target.value.toUpperCase() })
                    }
                    autoComplete="off"
                    placeholder="NGUYEN VAN A"
                    className={cn(inputClass, 'mt-1')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="card-expiry"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Hết hạn (MM/YY)
                    </label>
                    <input
                      id="card-expiry"
                      value={card.expiry}
                      onChange={(event) =>
                        setCard({ ...card, expiry: formatExpiry(event.target.value) })
                      }
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="12/30"
                      className={cn(inputClass, 'mt-1 font-mono')}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="card-cvc"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      CVC / CVV
                    </label>
                    <input
                      id="card-cvc"
                      value={card.cvc}
                      onChange={(event) =>
                        setCard({ ...card, cvc: event.target.value.replace(/\D/g, '').slice(0, 4) })
                      }
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="123"
                      className={cn(inputClass, 'mt-1 font-mono')}
                    />
                  </div>
                </div>
              </div>
              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || isFinished || !session.data}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-700 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-50"
              >
                <LockKeyhole size={15} aria-hidden="true" />
                Thanh toán {amount}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => void backToShop()}
            disabled={busy}
            className="mt-3 w-full text-center text-sm font-semibold text-slate-500 transition hover:text-slate-800 disabled:opacity-50"
          >
            Huỷ, quay lại cửa hàng
          </button>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Thẻ thử (bấm để điền)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Hạn bất kỳ trong tương lai, CVC 3 số bất kỳ, tên bất kỳ.
          </p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {MOCK_TEST_CARDS.map((test) => (
              <li key={test.number}>
                <button
                  type="button"
                  disabled={busy || Boolean(otpFor)}
                  onClick={() => {
                    setError(null);
                    setCard({
                      number: test.number,
                      expiry: card.expiry || '12/30',
                      cvc: card.cvc || '123',
                      holder: card.holder || 'KHACH THU',
                    });
                  }}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:text-sky-700 disabled:opacity-50"
                >
                  <span className="font-mono text-[13px]">{test.number}</span>
                  <span className="text-right text-xs text-slate-500">
                    {CARD_BRAND_LABELS[test.brand]} · {test.note}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

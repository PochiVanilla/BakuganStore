import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { BrandMark } from './BrandMark';

/** Máy này đã xem intro chưa — chỉ chiếu lần đầu, lần sau vào thẳng trang. */
const SEEN_KEY = 'td-bakugan:intro-seen';
/** Khoá cũ (chỉ nhớ trong một phiên) — vẫn tôn trọng để ai vừa xem không phải xem lại. */
const LEGACY_SESSION_KEY = 'td-bakugan:intro-played';
const DURATION_MS = 1800;

function hasSeen(): boolean {
  try {
    return (
      window.localStorage.getItem(SEEN_KEY) === '1' ||
      window.sessionStorage.getItem(LEGACY_SESSION_KEY) === '1'
    );
  } catch {
    // Bộ nhớ trình duyệt bị chặn (chế độ riêng tư) — cứ chiếu, không lỗi gì.
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // bỏ qua
  }
}

/**
 * Màn mở đầu: logo TD Bakugan hiện ra cùng quầng sáng, rồi vào thẳng trang.
 *
 * - Chỉ chiếu lần đầu tiên trên mỗi máy (khoảng 1,8 giây), lần sau vào thẳng trang.
 * - Chạm / bấm vào bất kỳ đâu trên màn hình, bấm phím bất kỳ hay cuộn chuột là
 *   vào thẳng trang ngay (có dòng nhắc "Chạm vào bất kỳ đâu để vào shop").
 * - Người bật "giảm chuyển động" trong hệ điều hành sẽ không thấy intro.
 */
export function BrandIntro() {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  // Quyết định chiếu hay không ngay ở lần chạy đầu phía trình duyệt.
  const [decided, setDecided] = useState(false);
  if (!decided) {
    setDecided(true);
    if (!hasSeen() && !prefersReducedMotion) {
      setIsVisible(true);
      // Ghi ngay: khách đóng tab giữa chừng thì lần sau cũng không phải xem lại.
      markSeen();
    }
  }

  const dismiss = useCallback(() => setIsVisible(false), []);

  useEffect(() => {
    if (!isVisible) return;

    const timer = window.setTimeout(dismiss, DURATION_MS);
    window.addEventListener('keydown', dismiss);
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('wheel', dismiss, { passive: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('wheel', dismiss);
      document.body.style.overflow = previousOverflow;
    };
  }, [isVisible, dismiss]);

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <m.div
          key="brand-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={dismiss}
          className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-background"
          role="presentation"
        >
          {/* Nền tinh vân toả ra từ tâm */}
          <m.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            style={{
              background:
                'radial-gradient(circle at 50% 46%, rgba(123,75,232,0.42), transparent 46%), radial-gradient(circle at 50% 46%, rgba(63,227,245,0.22), transparent 62%)',
            }}
          />

          {/* Sao lấp lánh */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {Array.from({ length: 26 }, (_, index) => (
              <m.span
                key={index}
                className="absolute rounded-full"
                style={{
                  top: `${(index * 37) % 100}%`,
                  left: `${(index * 53) % 100}%`,
                  width: index % 5 === 0 ? 3 : 2,
                  height: index % 5 === 0 ? 3 : 2,
                  backgroundColor: ['#F5C542', '#3FE3F5', '#E940D2', '#F5F5FA'][index % 4],
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0.4], scale: [0, 1.3, 1] }}
                transition={{
                  duration: 1.2,
                  delay: 0.15 + (index % 9) * 0.05,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Logo hiện ra */}
          <m.div
            aria-hidden="true"
            className="relative mb-7"
            initial={{ scale: 0.4, opacity: 0, rotate: -18 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Quầng sáng loé ra phía sau logo */}
            <m.span
              className="absolute inset-0 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2.1, 1.45], opacity: [0, 0.9, 0.4] }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              style={{
                background:
                  'radial-gradient(circle, rgba(233,64,210,0.55), rgba(123,75,232,0.25) 45%, transparent 70%)',
              }}
            />
            <BrandMark
              size={168}
              priority
              className="relative shadow-[0_0_40px_rgba(63,227,245,0.35)]"
            />
          </m.div>

          <m.p
            className="font-display text-[11px] font-bold tracking-[0.45em] text-gold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55 }}
          >
            SHOP
          </m.p>

          {/* Vạch sáng quét ngang */}
          <m.span
            aria-hidden="true"
            className="mt-4 block h-px bg-gradient-to-r from-transparent via-accent-cyan to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.65, ease: 'easeOut' }}
          />

          <m.p
            className="mt-4 px-6 text-center text-xs text-text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            Chiến binh Bakugan chính hãng — Feed bán mỗi tuần &amp; Đấu giá
          </m.p>

          <m.p
            className="absolute inset-x-0 bottom-20 text-center text-xs font-semibold text-accent-cyan sm:bottom-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.45, 1] }}
            transition={{ duration: 1.2, delay: 0.4, repeat: Infinity, repeatType: 'mirror' }}
          >
            Chạm vào bất kỳ đâu để vào shop
          </m.p>

          <m.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              dismiss();
            }}
            className="absolute right-5 bottom-6 rounded-lg border border-white/12 px-3.5 py-2 text-xs font-semibold text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan sm:right-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            Bỏ qua
          </m.button>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BrandMark } from './BrandMark';

const SESSION_KEY = 'td-bakugan:intro-played';
const DURATION_MS = 2800;

/** Đã chiếu intro trong phiên làm việc này chưa. */
function hasPlayed(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // sessionStorage bị chặn (chế độ riêng tư) — cứ chiếu, không lỗi gì.
    return false;
  }
}

function markPlayed(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // bỏ qua
  }
}

/**
 * Màn mở đầu: logo TD Bakugan hiện ra cùng quầng sáng, rồi vào thẳng trang.
 *
 * - Chỉ chiếu một lần mỗi phiên trình duyệt, không cản trở người quay lại.
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
    if (!hasPlayed() && !prefersReducedMotion) setIsVisible(true);
  }

  const dismiss = useCallback(() => {
    setIsVisible(false);
    markPlayed();
  }, []);

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
        <motion.div
          key="brand-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={dismiss}
          className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-background"
          role="presentation"
        >
          {/* Nền tinh vân toả ra từ tâm */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
            style={{
              background:
                'radial-gradient(circle at 50% 46%, rgba(123,75,232,0.42), transparent 46%), radial-gradient(circle at 50% 46%, rgba(63,227,245,0.22), transparent 62%)',
            }}
          />

          {/* Sao lấp lánh */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {Array.from({ length: 26 }, (_, index) => (
              <motion.span
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
                  duration: 1.8,
                  delay: 0.25 + (index % 9) * 0.07,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Logo hiện ra */}
          <motion.div
            aria-hidden="true"
            className="relative mb-7"
            initial={{ scale: 0.4, opacity: 0, rotate: -18 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Quầng sáng loé ra phía sau logo */}
            <motion.span
              className="absolute inset-0 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2.1, 1.45], opacity: [0, 0.9, 0.4] }}
              transition={{ duration: 1.1, delay: 0.3, ease: 'easeOut' }}
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
          </motion.div>

          <motion.p
            className="font-display text-[11px] font-bold tracking-[0.45em] text-gold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95 }}
          >
            SHOP
          </motion.p>

          {/* Vạch sáng quét ngang */}
          <motion.span
            aria-hidden="true"
            className="mt-4 block h-px bg-gradient-to-r from-transparent via-accent-cyan to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            transition={{ duration: 0.7, delay: 1.1, ease: 'easeOut' }}
          />

          <motion.p
            className="mt-4 px-6 text-center text-xs text-text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.35 }}
          >
            Chiến binh Bakugan chính hãng — Feed bán mỗi tuần &amp; Đấu giá
          </motion.p>

          <motion.p
            className="absolute inset-x-0 bottom-20 text-center text-xs font-semibold text-accent-cyan sm:bottom-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.45, 1] }}
            transition={{ duration: 1.6, delay: 0.6, repeat: Infinity, repeatType: 'mirror' }}
          >
            Chạm vào bất kỳ đâu để vào shop
          </motion.p>

          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              dismiss();
            }}
            className="absolute right-5 bottom-6 rounded-lg border border-white/12 px-3.5 py-2 text-xs font-semibold text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan sm:right-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            Bỏ qua
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

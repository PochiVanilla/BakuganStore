import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { DragonMark } from './DragonMark';

const SESSION_KEY = 'td-bakugan:intro-played';
const DURATION_MS = 3400;

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
 * Màn mở đầu: quả cầu Bakugan bung ra rồi chữ TD BAKUGAN SHOP hiện lên.
 *
 * - Chỉ chiếu một lần mỗi phiên trình duyệt, không cản trở người quay lại.
 * - Bấm phím bất kỳ, chạm màn hình hoặc nút "Bỏ qua" là tắt ngay.
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

  const word = 'BAKUGAN';

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="brand-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-background"
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

          {/* Huy hiệu rồng hiện ra */}
          <motion.div
            aria-hidden="true"
            className="relative mb-8"
            initial={{ scale: 0.3, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Quầng sáng loé ra phía sau rồng */}
            <motion.span
              className="absolute inset-0 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2.2, 1.5], opacity: [0, 0.9, 0.35] }}
              transition={{ duration: 1.2, delay: 0.35, ease: 'easeOut' }}
              style={{
                background:
                  'radial-gradient(circle, rgba(233,64,210,0.55), rgba(123,75,232,0.25) 45%, transparent 70%)',
              }}
            />
            <DragonMark size={132} framed={false} className="relative" />
          </motion.div>

          {/* Chữ TD */}
          <motion.p
            className="font-display text-5xl font-black tracking-[0.2em] text-primary-soft neon-text-pink sm:text-6xl"
            initial={{ opacity: 0, y: 24, letterSpacing: '0.6em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.2em' }}
            transition={{ duration: 0.75, delay: 1.15, ease: 'easeOut' }}
          >
            TD
          </motion.p>

          {/* Chữ BAKUGAN hiện từng ký tự */}
          <p className="mt-2 flex" aria-label="BAKUGAN">
            {word.split('').map((letter, index) => (
              <motion.span
                key={`${letter}-${index}`}
                aria-hidden="true"
                className="font-display text-2xl font-extrabold tracking-[0.34em] text-accent-cyan neon-text sm:text-3xl"
                initial={{ opacity: 0, y: 16, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.45,
                  delay: 1.5 + index * 0.075,
                  ease: 'easeOut',
                }}
              >
                {letter}
              </motion.span>
            ))}
          </p>

          {/* Vạch sáng quét ngang */}
          <motion.span
            aria-hidden="true"
            className="mt-5 block h-px bg-gradient-to-r from-transparent via-accent-cyan to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            transition={{ duration: 0.7, delay: 2.05, ease: 'easeOut' }}
          />

          <motion.p
            className="mt-4 font-display text-[11px] font-bold tracking-[0.45em] text-gold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.3 }}
          >
            SHOP
          </motion.p>

          <motion.p
            className="mt-3 text-xs text-text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 2.5 }}
          >
            Chiến binh Bakugan chính hãng — Sưu tầm &amp; Đấu giá
          </motion.p>

          <motion.button
            type="button"
            onClick={dismiss}
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

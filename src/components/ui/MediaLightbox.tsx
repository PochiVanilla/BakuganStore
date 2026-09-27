import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMediaSrc } from '@/hooks/useMediaSrc';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { cn } from '@/utils/cn';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Vuốt ngang quá ngần này (px) thì sang ảnh khác */
const SWIPE_DISTANCE = 60;
/** Di chuyển dưới ngần này (px) vẫn tính là chạm */
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 300;

interface Point {
  x: number;
  y: number;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

type Gesture =
  | { kind: 'drag'; start: Point; origin: Point; moved: boolean; onBackdrop: boolean }
  | { kind: 'pinch'; distance: number; scale: number; mid: Point; origin: Point };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Xem ảnh toàn màn hình: chụm hai ngón / chạm đúp / lăn chuột để phóng to, kéo để
 * di chuyển, vuốt ngang để sang ảnh khác. `onClose` trả về ảnh đang xem để gallery
 * bên dưới dừng đúng ảnh đó và đưa focus về đó.
 */
export function MediaLightbox({
  photos,
  startIndex,
  alt,
  onClose,
}: {
  photos: string[];
  startIndex: number;
  alt: string;
  onClose: (index: number) => void;
}) {
  const [index, setIndex] = useState(() => clamp(startIndex, 0, photos.length - 1));
  const [zoomed, setZoomed] = useState(false);
  const url = useMediaSrc(photos[index]);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const view = useRef<View>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ at: number; point: Point } | null>(null);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useLockBodyScroll(true);

  /** Toạ độ so với tâm khung xem */
  const toStage = (clientX: number, clientY: number): Point => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  /** Ghi vị trí mới lên ảnh (thẳng vào style, không render lại React mỗi lần ngón tay nhích). */
  const apply = useCallback((next: View, animate = false, keepInside = true): void => {
    const stage = stageRef.current;
    const image = imageRef.current;
    let { x, y } = next;
    if (keepInside && stage && image) {
      const maxX = Math.max(0, (image.offsetWidth * next.scale - stage.clientWidth) / 2);
      const maxY = Math.max(0, (image.offsetHeight * next.scale - stage.clientHeight) / 2);
      x = clamp(x, -maxX, maxX);
      y = clamp(y, -maxY, maxY);
    }
    view.current = { scale: next.scale, x, y };
    if (image) {
      image.style.transition = animate ? 'transform 220ms ease-out' : 'none';
      image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${next.scale})`;
    }
    setZoomed(next.scale > 1.01);
  }, []);

  const reset = useCallback((animate = true) => apply({ scale: 1, x: 0, y: 0 }, animate), [apply]);

  const go = useCallback(
    (delta: number): void => {
      setIndex((current) => clamp(current + delta, 0, photos.length - 1));
      view.current = { scale: 1, x: 0, y: 0 };
      setZoomed(false);
    },
    [photos.length],
  );

  const close = useCallback(() => onClose(index), [index, onClose]);

  // Mở ra thì đưa focus vào nút đóng. Đóng lại thì gallery tự đưa focus về đúng ảnh
  // vừa xem (trả về chỗ cũ sẽ làm băng ảnh cuộn ngược lại ảnh đã bấm lúc đầu).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, go]);

  // Lăn chuột / chụm trên touchpad để phóng to tại vị trí con trỏ (cần chặn trình duyệt tự zoom trang).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const focus = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      const { scale, x, y } = view.current;
      const nextScale = clamp(scale * Math.exp(-event.deltaY * 0.0015), 1, MAX_SCALE);
      const ratio = nextScale / scale;
      apply({
        scale: nextScale,
        x: focus.x - ratio * (focus.x - x),
        y: focus.y - ratio * (focus.y - y),
      });
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [apply]);

  const startGesture = (onBackdrop = false): void => {
    const points = [...pointers.current.values()];
    const { scale, x, y } = view.current;
    if (points.length >= 2) {
      const [a, b] = points as [Point, Point];
      gesture.current = {
        kind: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale,
        mid: toStage((a.x + b.x) / 2, (a.y + b.y) / 2),
        origin: { x, y },
      };
    } else if (points.length === 1) {
      gesture.current = {
        kind: 'drag',
        start: points[0]!,
        origin: { x, y },
        moved: false,
        onBackdrop,
      };
    } else {
      gesture.current = null;
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Giữ ngón tay / chuột cho khung xem kể cả khi ra ngoài; từ đây sự kiện luôn trỏ vào khung,
    // nên phải nhớ lúc chạm xuống có trúng ảnh hay không.
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture(event.target === event.currentTarget);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current) return;

    if (current.kind === 'pinch') {
      const points = [...pointers.current.values()];
      if (points.length < 2) return;
      const [a, b] = points as [Point, Point];
      const nextScale = clamp(
        (current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / current.distance,
        1,
        MAX_SCALE,
      );
      const mid = toStage((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Giữ nguyên điểm ảnh nằm giữa hai ngón lúc bắt đầu chụm.
      const ratio = nextScale / current.scale;
      apply({
        scale: nextScale,
        x: mid.x - ratio * (current.mid.x - current.origin.x),
        y: mid.y - ratio * (current.mid.y - current.origin.y),
      });
      return;
    }

    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!current.moved && Math.hypot(dx, dy) > TAP_SLOP) current.moved = true;
    if (!current.moved) return;
    if (view.current.scale > 1.01) {
      apply({ scale: view.current.scale, x: current.origin.x + dx, y: current.origin.y + dy });
    } else {
      // Chưa phóng to: ảnh chạy theo ngón tay để sang ảnh bên cạnh (hết ảnh thì kéo nặng tay).
      const edge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
      apply({ scale: 1, x: edge ? dx * 0.3 : dx, y: 0 }, false, false);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.delete(event.pointerId)) return;
    const current = gesture.current;

    if (current?.kind === 'pinch') {
      // Nhấc một ngón: ngón còn lại kéo tiếp. Thu nhỏ gần hết thì về khung vừa màn hình.
      startGesture();
      if (gesture.current?.kind === 'drag') gesture.current.moved = true;
      if (view.current.scale < 1.05) reset();
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!current) return;

    if (!current.moved) {
      if (event.type === 'pointercancel') return;
      const point = toStage(event.clientX, event.clientY);
      const previous = lastTap.current;
      if (
        previous &&
        event.timeStamp - previous.at < DOUBLE_TAP_MS &&
        Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < 30
      ) {
        lastTap.current = null;
        if (view.current.scale > 1.01) {
          reset();
          return;
        }
        // Phóng to ngay tại chỗ vừa chạm.
        const { scale, x, y } = view.current;
        const ratio = DOUBLE_TAP_SCALE / scale;
        apply(
          {
            scale: DOUBLE_TAP_SCALE,
            x: point.x - ratio * (point.x - x),
            y: point.y - ratio * (point.y - y),
          },
          true,
        );
        return;
      }
      lastTap.current = { at: event.timeStamp, point };
      // Chạm vào nền tối (không trúng ảnh) thì đóng.
      if (current.onBackdrop && view.current.scale <= 1.01) close();
      return;
    }

    if (view.current.scale <= 1.01) {
      const dx = event.clientX - current.start.x;
      if (dx <= -SWIPE_DISTANCE && hasNext) go(1);
      else if (dx >= SWIPE_DISTANCE && hasPrev) go(-1);
      else reset();
    }
  };

  const navButton =
    'absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/60 p-3 text-white transition hover:border-accent-cyan hover:text-accent-cyan disabled:opacity-0 sm:flex';

  return createPortal(
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — xem ảnh phóng to`}
      className="fixed inset-0 z-[150] flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-white/80 tabular-nums" aria-live="polite">
          Ảnh {index + 1} / {photos.length}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Đóng xem ảnh"
          className="rounded-full border border-white/15 bg-white/5 p-2.5 transition hover:border-accent-cyan hover:text-accent-cyan"
        >
          <X size={20} />
        </button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden select-none',
          zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
        )}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2 sm:p-6">
          {url ? (
            <img
              key={photos[index]}
              ref={imageRef}
              src={url}
              alt={`${alt} — ảnh ${index + 1}`}
              draggable={false}
              className="pointer-events-auto max-h-full max-w-full object-contain will-change-transform"
            />
          ) : (
            <span className="block aspect-square w-full max-w-md rounded-2xl bg-surface-2" />
          )}
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => go(-1)}
              disabled={!hasPrev}
              aria-label="Ảnh trước"
              className={cn(navButton, 'left-4')}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => go(1)}
              disabled={!hasNext}
              aria-label="Ảnh kế tiếp"
              className={cn(navButton, 'right-4')}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {photos.length > 1 && (
          <div className="flex gap-1.5" aria-hidden="true">
            {photos.map((photo, dot) => (
              <span
                key={photo}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  dot === index ? 'w-5 bg-accent-cyan' : 'w-1.5 bg-white/30',
                )}
              />
            ))}
          </div>
        )}
        <p className="text-center text-[11px] text-white/55">
          <span className="pointer-fine:hidden">
            Chụm hai ngón hoặc chạm đúp để phóng to · vuốt ngang để xem ảnh khác
          </span>
          <span className="hidden pointer-fine:inline">
            Lăn chuột hoặc bấm đúp để phóng to · kéo để di chuyển · phím ← → để đổi ảnh
          </span>
        </p>
      </div>
    </m.div>,
    document.body,
  );
}

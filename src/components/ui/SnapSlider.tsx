import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { cn } from '@/utils/cn';

interface DragState {
  startX: number;
  startLeft: number;
  moved: boolean;
}

/**
 * Băng trượt ngang: điện thoại vuốt, máy tính kéo chuột hoặc bấm mũi tên.
 * Mỗi phần tử con là một thẻ; thẻ dừng đúng mép khi thả tay (scroll-snap).
 */
export function SnapSlider({
  label,
  children,
  itemClassName = 'w-[82%] sm:w-[calc(50%-10px)] lg:w-[calc((100%-40px)/3)]',
  className,
}: {
  /** Tên vùng cho trình đọc màn hình, VD "Các feed gần đây" */
  label: string;
  children: ReactNode;
  /** Bề rộng mỗi thẻ theo cỡ màn hình */
  itemClassName?: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const atStart = track.scrollLeft <= 4;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    setEdges((current) =>
      current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd },
    );
  }, []);

  // Đổi cỡ màn hình / thêm thẻ -> tính lại có còn cuộn được về hai phía không.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => updateEdges());
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateEdges]);

  const scrollByPage = (direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  };

  // Kéo bằng chuột (cảm ứng đã tự vuốt được).
  const onPointerDown = (event: PointerEvent<HTMLUListElement>): void => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      startLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLUListElement>): void => {
    const drag = dragRef.current;
    if (!drag) return;
    const track = event.currentTarget;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) > 6) {
      drag.moved = true;
      track.setPointerCapture(event.pointerId);
      // Tắt dừng-đúng-mép trong lúc kéo cho mượt, thả tay thì bật lại để thẻ tự vào vị trí.
      track.style.scrollSnapType = 'none';
      track.style.cursor = 'grabbing';
      // Kéo thì không bôi đen chữ trên thẻ.
      document.body.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
    }
    if (drag.moved) track.scrollLeft = drag.startLeft - distance;
  };

  const endDrag = (event: PointerEvent<HTMLUListElement>): void => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return;
    const track = event.currentTarget;
    track.style.scrollSnapType = '';
    track.style.cursor = '';
    document.body.style.userSelect = '';
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    // Vừa kéo xong thì không tính là bấm vào thẻ.
    suppressClickRef.current = true;
  };

  const items = Children.toArray(children);

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={trackRef}
        aria-label={label}
        onScroll={updateEdges}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragStart={(event) => event.preventDefault()}
        className="-mx-4 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto overscroll-x-contain px-4 pb-2 focus-visible:outline-none sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {items.map((child, index) => (
          <li
            key={isValidElement(child) && child.key !== null ? child.key : index}
            className={cn('shrink-0 snap-start', itemClassName)}
          >
            {child}
          </li>
        ))}
      </ul>

      {/* Mũi tên cho máy tính; điện thoại vuốt là đủ */}
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        disabled={edges.atStart}
        aria-label="Xem các thẻ trước"
        className="absolute top-[38%] -left-4 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-surface-2 text-text shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] transition hover:border-accent-cyan/60 hover:text-accent-cyan disabled:pointer-events-none disabled:opacity-0 sm:flex xl:-left-6"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        disabled={edges.atEnd}
        aria-label="Xem các thẻ tiếp theo"
        className="absolute top-[38%] -right-4 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-surface-2 text-text shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] transition hover:border-accent-cyan/60 hover:text-accent-cyan disabled:pointer-events-none disabled:opacity-0 sm:flex xl:-right-6"
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>

      {!edges.atEnd && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-text-muted sm:hidden">
          <MoveHorizontal size={13} aria-hidden="true" /> Vuốt ngang để xem thêm
        </p>
      )}
    </div>
  );
}

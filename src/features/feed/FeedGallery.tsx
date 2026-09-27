import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { RefImage } from '@/components/ui';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { cn } from '@/utils/cn';

/**
 * Ảnh chụp cả lô của một feed. Bấm vào ảnh để xem toàn màn hình (điện thoại
 * không rê chuột được nên phóng to bằng cách mở ảnh lớn).
 */
export function FeedGallery({ images, alt }: { images: readonly string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const current = images[active] ?? images[0];
  const hasMany = images.length > 1;

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
      if (event.key === 'ArrowRight') setActive((index) => (index + 1) % images.length);
      if (event.key === 'ArrowLeft') {
        setActive((index) => (index - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, images.length]);

  const step = (delta: number): void => {
    setActive((index) => (index + delta + images.length) % images.length);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-white/8 bg-surface-2"
        aria-label="Xem ảnh lô hàng cỡ lớn"
      >
        <RefImage
          src={current}
          alt={`${alt} — ảnh ${active + 1}`}
          width={1280}
          height={720}
          className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span
          className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-background/80 px-2.5 py-1.5 text-[11px] text-text backdrop-blur"
          aria-hidden="true"
        >
          <Expand size={13} />
          Bấm để xem rõ từng con
        </span>
      </button>

      {hasMany && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((image, index) => (
            <li key={`${image.slice(-32)}-${index}`}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Xem ảnh ${index + 1}`}
                aria-current={index === active}
                className={cn(
                  'block w-full overflow-hidden rounded-lg border-2 transition',
                  index === active
                    ? 'border-accent-cyan'
                    : 'border-white/8 opacity-70 hover:opacity-100',
                )}
              >
                <RefImage
                  src={image}
                  alt=""
                  width={160}
                  height={90}
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-3 sm:p-8"
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 rounded-full border border-white/20 bg-white/10 p-2.5 text-white hover:bg-white/20"
              aria-label="Đóng ảnh"
            >
              <X size={20} />
            </button>
            <RefImage
              src={current}
              alt={`${alt} — ảnh ${active + 1}`}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-3 text-white hover:bg-white/20"
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-3 text-white hover:bg-white/20"
                  aria-label="Ảnh kế tiếp"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Gallery có zoom: rê chuột để phóng to, bấm mũi tên hoặc thumbnail để đổi ảnh. */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);

  const activeImage = images[activeIndex] ?? images[0] ?? '';

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  const step = (delta: number): void => {
    setActiveIndex((index) => (index + delta + images.length) % images.length);
  };

  return (
    <div>
      <div
        ref={frameRef}
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
        className="group relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-surface-2"
      >
        <img
          src={activeImage}
          alt={`${alt} — ảnh ${activeIndex + 1}`}
          width={600}
          height={600}
          className="h-full w-full object-cover transition-transform duration-200"
          style={{
            transform: isZooming ? 'scale(2)' : 'scale(1)',
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        />

        <span
          className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-background/75 px-2.5 py-1.5 text-[11px] text-text-muted backdrop-blur transition-opacity group-hover:opacity-0"
          aria-hidden="true"
        >
          <ZoomIn size={13} />
          Rê chuột để phóng to
        </span>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Ảnh trước"
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-white/10 bg-background/80 p-2.5 text-text-muted opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-accent-cyan focus-visible:opacity-100"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Ảnh kế tiếp"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-white/10 bg-background/80 p-2.5 text-text-muted opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-accent-cyan focus-visible:opacity-100"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3">
          {images.map((image, index) => (
            <li key={image.slice(-24) + index}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Xem ảnh ${index + 1}`}
                aria-current={index === activeIndex}
                className={cn(
                  'block w-full overflow-hidden rounded-xl border-2 transition',
                  index === activeIndex
                    ? 'border-accent-cyan shadow-glow-cyan'
                    : 'border-white/8 opacity-70 hover:border-white/25 hover:opacity-100',
                )}
              >
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  width={150}
                  height={150}
                  className="aspect-square w-full bg-surface-2 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

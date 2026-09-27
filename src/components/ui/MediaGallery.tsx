import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Play, ZoomIn } from 'lucide-react';
import { useMediaSrc } from '@/hooks/useMediaSrc';
import { cn } from '@/utils/cn';
import { RefImage } from './RefImage';
import { MediaLightbox } from './MediaLightbox';

interface Slide {
  kind: 'photo' | 'video';
  ref: string;
}

function VideoSlide({ video, label, active }: { video: string; label: string; active: boolean }) {
  const url = useMediaSrc(video);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Lướt sang ảnh khác thì dừng video.
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);

  if (!url)
    return <span role="img" aria-label={label} className="block h-full w-full bg-surface-2" />;
  return (
    // Video do shop tự quay để khách xem kỹ hàng, không có lời thoại nên không kèm phụ đề.
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      src={url}
      controls
      playsInline
      preload="metadata"
      tabIndex={active ? undefined : -1}
      aria-label={label}
      className="h-full w-full bg-black object-contain"
    />
  );
}

/**
 * Bộ ảnh sản phẩm: các ảnh trước, video giới thiệu (nếu có) luôn ở cuối.
 * - Máy tính: rê chuột để phóng to tại chỗ, bấm để xem toàn màn hình.
 * - Điện thoại: vuốt ngang đổi ảnh, chạm để mở khung xem có chụm / chạm đúp phóng to.
 * Chưa có ảnh thì để khung trống.
 */
export function MediaGallery({
  photos,
  video,
  alt,
  className,
}: {
  photos: string[];
  video?: string;
  alt: string;
  className?: string;
}) {
  const slides: Slide[] = [
    ...photos.map((ref) => ({ kind: 'photo' as const, ref })),
    ...(video ? [{ kind: 'video' as const, ref: video }] : []),
  ];
  const trackRef = useRef<HTMLDivElement>(null);
  const slideButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(0);
  const [hoverZoom, setHoverZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activeSlide = slides[active];

  const showSlide = (index: number): void => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' as ScrollBehavior });
    setActive(index);
  };

  const step = (delta: number): void => {
    showSlide((active + delta + slides.length) % slides.length);
  };

  // Vuốt tay (scroll-snap) -> biết đang ở ảnh nào.
  const onScroll = (): void => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== active) {
      setActive(index);
      setHoverZoom(null);
    }
  };

  const onHover = (event: PointerEvent<HTMLElement>): void => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverZoom({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  if (slides.length === 0) {
    return (
      <div className={className}>
        <span
          role="img"
          aria-label={alt}
          className="block aspect-square w-full rounded-2xl border border-white/8 bg-surface-2"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="group relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-surface-2">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {slides.map((slide, index) => (
            <div
              key={`${slide.kind}-${slide.ref}`}
              className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden"
            >
              {slide.kind === 'video' ? (
                <VideoSlide
                  video={slide.ref}
                  label={`Video giới thiệu ${alt}`}
                  active={index === active}
                />
              ) : (
                <button
                  ref={(element) => {
                    slideButtons.current[index] = element;
                  }}
                  type="button"
                  tabIndex={index === active ? 0 : -1}
                  onClick={() => setLightboxIndex(index)}
                  onPointerMove={onHover}
                  onPointerLeave={() => setHoverZoom(null)}
                  aria-label={`Phóng to ảnh ${index + 1} của ${alt}`}
                  className="block h-full w-full cursor-zoom-in"
                >
                  <RefImage
                    src={slide.ref}
                    alt={`${alt} — ảnh ${index + 1}`}
                    width={800}
                    height={800}
                    decoding="async"
                    sizes="(min-width: 1024px) 600px, 100vw"
                    className="h-full w-full object-cover transition-transform duration-200"
                    style={
                      hoverZoom && index === active
                        ? {
                            transform: 'scale(2)',
                            transformOrigin: `${hoverZoom.x}% ${hoverZoom.y}%`,
                          }
                        : undefined
                    }
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <span className="pointer-events-none absolute top-3 left-3 rounded-lg bg-background/85 px-2 py-1 font-display text-[11px] font-bold text-text tabular-nums">
            {activeSlide?.kind === 'video' ? 'VIDEO' : `${active + 1}/${photos.length}`}
          </span>
        )}
        {activeSlide?.kind === 'photo' && (
          <span
            className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-background/85 px-2.5 py-1.5 text-[11px] text-text-muted transition-opacity group-hover:opacity-0"
            aria-hidden="true"
          >
            <ZoomIn size={13} />
            <span className="pointer-fine:hidden">Chạm để phóng to</span>
            <span className="hidden pointer-fine:inline">Rê chuột để phóng to</span>
          </span>
        )}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Ảnh trước"
              className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full border border-white/10 bg-background/80 p-2.5 text-text-muted opacity-0 transition group-hover:opacity-100 hover:text-accent-cyan focus-visible:opacity-100 sm:block"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Ảnh kế tiếp"
              className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full border border-white/10 bg-background/80 p-2.5 text-text-muted opacity-0 transition group-hover:opacity-100 hover:text-accent-cyan focus-visible:opacity-100 sm:block"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3">
          {slides.map((slide, index) => (
            <li key={`${slide.kind}-${slide.ref}`}>
              <button
                type="button"
                onClick={() => showSlide(index)}
                aria-label={
                  slide.kind === 'video' ? 'Xem video giới thiệu' : `Xem ảnh ${index + 1}`
                }
                aria-current={index === active}
                className={cn(
                  'relative block w-full overflow-hidden rounded-xl border-2 transition',
                  index === active
                    ? 'border-accent-cyan shadow-glow-cyan'
                    : 'border-white/8 opacity-70 hover:border-white/25 hover:opacity-100',
                )}
              >
                {slide.kind === 'video' ? (
                  <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-black/60 text-text">
                    <Play size={20} className="fill-current" aria-hidden="true" />
                    <span className="text-[10px] font-bold tracking-wider">VIDEO</span>
                  </span>
                ) : (
                  <RefImage
                    src={slide.ref}
                    alt=""
                    loading="lazy"
                    width={150}
                    height={150}
                    className="aspect-square w-full bg-surface-2 object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          photos={photos}
          startIndex={lightboxIndex}
          alt={alt}
          onClose={(index) => {
            setLightboxIndex(null);
            showSlide(index);
            requestAnimationFrame(() =>
              slideButtons.current[index]?.focus({ preventScroll: true }),
            );
          }}
        />
      )}
    </div>
  );
}

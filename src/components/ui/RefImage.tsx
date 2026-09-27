import type { ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { useImageSrc } from '@/hooks/useImageSrc';
import { cn } from '@/utils/cn';

/** Ảnh lô chụp sẵn trong public/feeds có thêm bản 640px và 960px (VD lo-mau-01-640.webp). */
const FEED_PHOTO = /^\/feeds\/([\w-]+)\.webp$/;

function feedPhotoSrcSet(url: string): string | undefined {
  const name = url.match(FEED_PHOTO)?.[1];
  if (!name || /-(640|960)$/.test(name)) return undefined;
  return `/feeds/${name}-640.webp 640w, /feeds/${name}-960.webp 960w, /feeds/${name}.webp 1280w`;
}

/**
 * Ảnh nhận mã tham chiếu (URL, đường dẫn, data-URI hoặc "idb:" của ảnh tải lên
 * ở chế độ mock). Trong lúc đọc ảnh thì hiện nền mờ đúng kích thước.
 * Ảnh lô có sẵn nhiều cỡ thì điện thoại tự tải bản nhỏ (truyền `sizes` cho đúng).
 */
export function RefImage({
  src,
  alt,
  className,
  srcSet,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | undefined; alt: string }) {
  const url = useImageSrc(src);
  if (!url) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn(
          'flex items-center justify-center bg-surface-2 text-text-muted/50',
          className,
        )}
      >
        {src?.startsWith('idb:') ? null : <ImageOff size={22} aria-hidden="true" />}
      </span>
    );
  }
  return (
    <img
      src={url}
      srcSet={srcSet ?? feedPhotoSrcSet(url)}
      alt={alt}
      className={className}
      {...rest}
    />
  );
}

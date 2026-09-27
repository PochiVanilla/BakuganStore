import type { ImgHTMLAttributes } from 'react';
import { useMediaSrc } from '@/hooks/useMediaSrc';
import { cn } from '@/utils/cn';

/** Ảnh lô chụp sẵn trong public/feeds có thêm bản 640px và 960px (VD lo-mau-01-640.webp). */
const FEED_PHOTO = /^\/feeds\/([\w-]+)\.webp$/;

function feedPhotoSrcSet(url: string): string | undefined {
  const name = url.match(FEED_PHOTO)?.[1];
  if (!name || /-(640|960)$/.test(name)) return undefined;
  return `/feeds/${name}-640.webp 640w, /feeds/${name}-960.webp 960w, /feeds/${name}.webp 1280w`;
}

/**
 * Ảnh nhận mã tham chiếu (URL, đường dẫn hoặc "idb:" của ảnh tải lên ở chế độ mock).
 * Chưa có ảnh thì hiện khung trống đúng kích thước.
 * Ảnh lô có sẵn nhiều cỡ thì điện thoại tự tải bản nhỏ (truyền `sizes` cho đúng).
 */
export function RefImage({
  src,
  alt,
  className,
  srcSet,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | undefined; alt: string }) {
  const url = useMediaSrc(src);
  // Chưa có ảnh (hoặc đang đọc ảnh tải lên) -> khung trống đúng kích thước, không vẽ gì.
  if (!url) {
    return <span role="img" aria-label={alt} className={cn('block bg-surface-2', className)} />;
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

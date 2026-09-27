import type { ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { useImageSrc } from '@/hooks/useImageSrc';
import { cn } from '@/utils/cn';

/**
 * Ảnh nhận mã tham chiếu (URL, đường dẫn, data-URI hoặc "idb:" của ảnh tải lên
 * ở chế độ mock). Trong lúc đọc ảnh thì hiện nền mờ đúng kích thước.
 */
export function RefImage({
  src,
  alt,
  className,
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
  return <img src={url} alt={alt} className={className} {...rest} />;
}

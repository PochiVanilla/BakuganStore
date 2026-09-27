import { cn } from '@/utils/cn';

/**
 * Logo tròn của shop (chữ TD tím, BAKUGAN cyan, trăng khuyết vàng).
 * Ảnh gốc nằm ở public/brand — thay file ở đó là cả web đổi theo.
 */
export function BrandMark({
  size = 44,
  className,
  alt = '',
  priority = false,
}: {
  size?: number;
  className?: string;
  /** Để trống khi đứng cạnh chữ "TD BAKUGAN" (tránh đọc trùng) */
  alt?: string;
  /** Logo ở đầu trang: tải ngay, không đợi */
  priority?: boolean;
}) {
  return (
    <img
      src="/brand/logo-192.webp"
      srcSet="/brand/logo-96.webp 96w, /brand/logo-192.webp 192w, /brand/logo-320.webp 320w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('shrink-0 rounded-full ring-1 ring-white/12 select-none', className)}
    />
  );
}

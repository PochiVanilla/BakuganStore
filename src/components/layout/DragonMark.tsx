import { useId } from 'react';
import { BrandDragon } from '@/features/home/BrandDragon';
import { cn } from '@/utils/cn';

/**
 * Dấu hiệu nhận diện của shop: huy hiệu rồng trong khung tròn neon.
 * Dùng cho logo ở header/footer và cho màn intro.
 */
export function DragonMark({
  size = 44,
  className,
  /** Có vẽ khung tròn và mặt trăng quanh rồng hay không */
  framed = true,
  title,
}: {
  size?: number;
  className?: string;
  framed?: boolean;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `dragon-mark-${uid}`;
  const glowId = `dragon-mark-glow-${uid}`;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="6%" y1="94%" x2="94%" y2="6%">
          <stop offset="0%" stopColor="#3FE3F5" />
          <stop offset="42%" stopColor="#8B5CF6" />
          <stop offset="78%" stopColor="#E940D2" />
          <stop offset="100%" stopColor="#F5C542" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#E940D2" floodOpacity="0.55" />
        </filter>
      </defs>

      {framed && (
        <>
          {/* Nền tròn tối để rồng luôn nổi bật */}
          <circle cx="100" cy="100" r="98" fill="#0A0A12" />
          {/* Mặt trăng khuyết vàng ở góc trên phải */}
          <path d="M150 12a46 46 0 1 0 0 84 54 54 0 0 1 0-84Z" fill="#F5C542" opacity="0.5" />
          <circle
            cx="100"
            cy="100"
            r="96"
            fill="none"
            stroke="#3FE3F5"
            strokeOpacity="0.45"
            strokeWidth="3"
          />
        </>
      )}

      <g filter={`url(#${glowId})`}>
        <BrandDragon fill={`url(#${gradientId})`} />
      </g>

      {framed && (
        <>
          {/* Ngôi sao lấp lánh trang trí */}
          <circle cx="26" cy="46" r="4" fill="#3FE3F5" opacity="0.9" />
          <circle cx="40" cy="168" r="3" fill="#F5C542" opacity="0.8" />
        </>
      )}
    </svg>
  );
}

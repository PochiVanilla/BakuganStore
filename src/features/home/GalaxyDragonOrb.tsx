import { useId } from 'react';
import { cn } from '@/utils/cn';
import { BrandDragon } from './BrandDragon';

/**
 * Quả cầu Bakugan với tinh vân galaxy bên trong và một con rồng neon cuộn quanh.
 *
 * Toàn bộ là vector tự vẽ nên không phụ thuộc ảnh ngoài, không dùng tạo hình
 * nhân vật có bản quyền, và sắc nét ở mọi độ phân giải màn hình.
 */
export function GalaxyDragonOrb({ className }: { className?: string }) {
  // useId để nhiều bản trên cùng một trang không trùng id của gradient/filter.
  const uid = useId().replace(/:/g, '');
  const id = (name: string): string => `${name}-${uid}`;

  return (
    <svg
      viewBox="0 0 420 420"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label="Quả cầu Bakugan phát sáng với hình rồng neon cuộn quanh"
    >
      <defs>
        {/* Nền tinh vân bên trong quả cầu */}
        <radialGradient id={id('nebula')} cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#2A4A7A" />
          <stop offset="30%" stopColor="#2B2159" />
          <stop offset="60%" stopColor="#1E1140" />
          <stop offset="100%" stopColor="#0A0620" />
        </radialGradient>

        {/* Lớp tối phủ mép để quả cầu có khối */}
        <radialGradient id={id('shade')} cx="34%" cy="28%" r="76%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#05010F" stopOpacity="0.85" />
        </radialGradient>

        {/* Vệt sáng highlight trên mặt cầu */}
        <linearGradient id={id('gloss')} x1="18%" y1="8%" x2="70%" y2="72%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.62" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Thân rồng chuyển sắc neon */}
        <linearGradient id={id('dragon')} x1="8%" y1="92%" x2="92%" y2="8%">
          <stop offset="0%" stopColor="#3FE3F5" />
          <stop offset="38%" stopColor="#8B5CF6" />
          <stop offset="72%" stopColor="#E940D2" />
          <stop offset="100%" stopColor="#F5C542" />
        </linearGradient>

        {/* Vành đai kim loại quanh xích đạo quả cầu */}
        <linearGradient id={id('belt')} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1B1B2E" />
          <stop offset="18%" stopColor="#6E6E92" />
          <stop offset="50%" stopColor="#C9C9E4" />
          <stop offset="82%" stopColor="#6E6E92" />
          <stop offset="100%" stopColor="#1B1B2E" />
        </linearGradient>

        <radialGradient id={id('core')} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#FFF4CE" />
          <stop offset="45%" stopColor="#F5C542" />
          <stop offset="100%" stopColor="#B87A10" />
        </radialGradient>

        {/* Quầng sáng chung */}
        <filter id={id('glow')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Quầng riêng cho rồng — nhẹ để giữ nét, chỉ đủ phát sáng */}
        <filter id={id('dragonGlow')} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#3FE3F5" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor="#E940D2" floodOpacity="0.35" />
        </filter>

        <filter id={id('softGlow')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Giữ hoạ tiết tinh vân nằm gọn trong quả cầu */}
        <clipPath id={id('orbClip')}>
          <circle cx="210" cy="210" r="132" />
        </clipPath>
      </defs>

      {/* Hào quang ngoài cùng */}
      <circle cx="210" cy="210" r="176" fill="#7B4BE8" opacity="0.14" />
      <circle cx="210" cy="210" r="150" fill="#3FE3F5" opacity="0.10" />

      {/* Vòng quỹ đạo mảnh */}
      <g opacity="0.5">
        <ellipse
          cx="210"
          cy="210"
          rx="172"
          ry="58"
          fill="none"
          stroke="#3FE3F5"
          strokeOpacity="0.35"
          strokeWidth="1.4"
          transform="rotate(-22 210 210)"
        />
        <ellipse
          cx="210"
          cy="210"
          rx="164"
          ry="44"
          fill="none"
          stroke="#E940D2"
          strokeOpacity="0.28"
          strokeWidth="1.2"
          transform="rotate(20 210 210)"
        />
      </g>

      {/* ---------- Thân quả cầu ---------- */}
      <g>
        <circle cx="210" cy="210" r="132" fill={`url(#${id('nebula')})`} />

        {/* Tinh vân xoáy bên trong */}
        <g clipPath={`url(#${id('orbClip')})`} opacity="0.62">
          <path
            d="M70 250c40-58 92-88 150-92 44-3 78 10 104 38-34-14-70-16-108-6-52 13-96 44-132 92Z"
            fill="#0B0620"
            opacity="0.55"
          />
          <path
            d="M96 300c30-40 70-64 120-72 46-7 86 4 118 32-38-12-76-12-114 0-46 14-84 42-114 82Z"
            fill="#F5C542"
            opacity="0.12"
          />
          <ellipse
            cx="156"
            cy="158"
            rx="62"
            ry="38"
            fill="#FFFFFF"
            opacity="0.14"
            transform="rotate(-28 156 158)"
          />
          <ellipse
            cx="272"
            cy="268"
            rx="54"
            ry="30"
            fill="#E940D2"
            opacity="0.22"
            transform="rotate(-18 272 268)"
          />
          {/* Sao nhỏ trong tinh vân */}
          <g fill="#FFFFFF">
            <circle cx="146" cy="136" r="2.4" opacity="0.9" />
            <circle cx="262" cy="160" r="1.8" opacity="0.75" />
            <circle cx="190" cy="268" r="2" opacity="0.7" />
            <circle cx="292" cy="228" r="1.5" opacity="0.6" />
            <circle cx="126" cy="230" r="1.6" opacity="0.65" />
            <circle cx="238" cy="112" r="1.4" opacity="0.55" />
          </g>
        </g>

        <circle cx="210" cy="210" r="132" fill={`url(#${id('shade')})`} />

        {/* Vành đai xích đạo của quả cầu */}
        <g>
          <rect
            x="78"
            y="200"
            width="264"
            height="20"
            rx="10"
            fill={`url(#${id('belt')})`}
            opacity="0.5"
          />
          <rect x="78" y="200" width="264" height="6" rx="3" fill="#FFFFFF" opacity="0.18" />
          {/* Khe mở của cơ cấu bung nở */}
          <rect x="78" y="206" width="264" height="3" fill="#05010F" opacity="0.6" />
        </g>

        {/* ---------- Huy hiệu rồng nằm giữa quả cầu ---------- */}
        <g filter={`url(#${id('dragonGlow')})`} transform="translate(80 80) scale(1.3)">
          {/* Lớp tối phía sau tạo viền, giúp rồng tách hẳn khỏi tinh vân */}
          <g opacity="0.5" transform="translate(0 1.5)">
            <BrandDragon fill="#05010F" />
          </g>
          <BrandDragon fill={`url(#${id('dragon')})`} />
        </g>

        {/* Vệt sáng bóng trên mặt cầu */}
        <path
          d="M210 78a132 132 0 0 0-104 214c-8-64 22-122 78-152 22-12 44-18 66-18Z"
          fill={`url(#${id('gloss')})`}
        />

        {/* Viền ngoài quả cầu */}
        <circle
          cx="210"
          cy="210"
          r="132"
          fill="none"
          stroke="#3FE3F5"
          strokeOpacity="0.45"
          strokeWidth="1.6"
        />
      </g>

      {/* Sao lấp lánh quanh quả cầu */}
      <g>
        <circle cx="66" cy="112" r="3" fill="#F5C542" opacity="0.9" />
        <circle cx="352" cy="140" r="2.4" fill="#3FE3F5" opacity="0.8" />
        <circle cx="330" cy="330" r="2.8" fill="#E940D2" opacity="0.75" />
        <circle cx="88" cy="326" r="2" fill="#F5F5FA" opacity="0.7" />
        <circle cx="386" cy="230" r="1.8" fill="#F5C542" opacity="0.6" />
        <circle cx="34" cy="214" r="1.6" fill="#3FE3F5" opacity="0.55" />
      </g>
    </svg>
  );
}

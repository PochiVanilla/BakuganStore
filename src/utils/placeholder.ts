import type { BakuganAttribute } from '@/types';

/**
 * Ảnh placeholder sinh tại chỗ dưới dạng SVG data-URI.
 * Không tải ảnh ngoài, không dùng hình nhân vật có bản quyền —
 * khi nối backend chỉ cần thay bằng URL ảnh thật trong `product.images`.
 */

const ATTRIBUTE_COLORS: Record<BakuganAttribute, readonly [string, string]> = {
  pyrus: ['#FF4D3D', '#FF9A3D'],
  aquos: ['#3FA9F5', '#3FE3F5'],
  subterra: ['#C8853A', '#F5C542'],
  haos: ['#EDEDDC', '#FFF6B8'],
  darkus: ['#8B5CF6', '#E940D2'],
  ventus: ['#4ADE80', '#3FE3F5'],
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

function initials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** Ảnh sản phẩm vuông: quả cầu chiến đấu cách điệu, tô theo màu hệ. */
export function productPlaceholder(
  label: string,
  attribute: BakuganAttribute,
  variant = 0,
): string {
  const [from, to] = ATTRIBUTE_COLORS[attribute];
  const seed = hashSeed(`${label}-${variant}`);
  const uid = `td${seed % 99991}`;
  const tilt = (seed % 40) - 20;
  const ringGap = 14 + (seed % 22);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img">
  <defs>
    <radialGradient id="bg${uid}" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#1E1E2E"/>
      <stop offset="100%" stop-color="#0A0A12"/>
    </radialGradient>
    <linearGradient id="ball${uid}" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0%" stop-color="${to}"/>
      <stop offset="55%" stop-color="${from}"/>
      <stop offset="100%" stop-color="#14141F"/>
    </linearGradient>
    <radialGradient id="glow${uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${from}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${from}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shine${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg${uid})"/>
  <circle cx="300" cy="290" r="250" fill="url(#glow${uid})"/>
  <g opacity="0.75">
    <circle cx="${90 + (seed % 60)}" cy="${80 + (seed % 40)}" r="3" fill="#F5C542"/>
    <circle cx="${470 - (seed % 70)}" cy="${120 + (seed % 50)}" r="2" fill="#3FE3F5"/>
    <circle cx="${120 + (seed % 90)}" cy="${470 - (seed % 40)}" r="2.5" fill="#E940D2"/>
    <circle cx="500" cy="430" r="2" fill="#F5C542"/>
  </g>
  <g transform="rotate(${tilt} 300 290)">
    <circle cx="300" cy="290" r="172" fill="url(#ball${uid})"/>
    <circle cx="300" cy="290" r="172" fill="none" stroke="#0A0A12" stroke-opacity="0.55" stroke-width="6"/>
    <ellipse cx="300" cy="290" rx="172" ry="${ringGap}" fill="#0A0A12" fill-opacity="0.45"/>
    <ellipse cx="300" cy="290" rx="${ringGap + 30}" ry="172" fill="#0A0A12" fill-opacity="0.28"/>
    <circle cx="300" cy="290" r="58" fill="#0A0A12" fill-opacity="0.65"/>
    <circle cx="300" cy="290" r="40" fill="${to}" fill-opacity="0.9"/>
    <circle cx="300" cy="290" r="40" fill="none" stroke="#F5F5FA" stroke-opacity="0.35" stroke-width="3"/>
    <path d="M300 118 a172 172 0 0 1 122 50 l-30 30 a130 130 0 0 0 -92 -38 z" fill="url(#shine${uid})"/>
  </g>
  <text x="300" y="303" font-family="Orbitron, Arial, sans-serif" font-size="34" font-weight="800"
        text-anchor="middle" fill="#0A0A12" opacity="0.85">${initials(label)}</text>
  <text x="300" y="545" font-family="Orbitron, Arial, sans-serif" font-size="26" font-weight="700"
        letter-spacing="7" text-anchor="middle" fill="#F5F5FA" opacity="0.32">TD BAKUGAN</text>
</svg>`;
  return toDataUri(svg);
}

/** Ảnh bìa bài viết (tỉ lệ 1200x630). */
export function blogPlaceholder(label: string, index = 0): string {
  const palettes: ReadonlyArray<readonly [string, string]> = [
    ['#7B4BE8', '#E940D2'],
    ['#3FE3F5', '#7B4BE8'],
    ['#F5C542', '#E940D2'],
    ['#4ADE80', '#3FE3F5'],
    ['#FF4D3D', '#F5C542'],
    ['#E940D2', '#3FE3F5'],
  ];
  const seed = hashSeed(`${label}-${index}`);
  const [from, to] = palettes[seed % palettes.length] ?? palettes[0]!;
  const uid = `b${seed % 99991}`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img">
  <defs>
    <linearGradient id="g${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${to}" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="r${uid}" cx="78%" cy="26%" r="50%">
      <stop offset="0%" stop-color="#F5C542" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#F5C542" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0A0A12"/>
  <rect width="1200" height="630" fill="url(#g${uid})" opacity="0.32"/>
  <circle cx="940" cy="170" r="180" fill="url(#r${uid})"/>
  <path d="M1000 90a92 92 0 1 0 0 168 104 104 0 0 1 0-168z" fill="#F5C542" opacity="0.75"/>
  <g stroke="${to}" stroke-opacity="0.32" stroke-width="2" fill="none">
    <path d="M-40 520 L320 360 L640 470 L980 300 L1240 400"/>
    <path d="M-40 600 L300 450 L620 560 L960 390 L1240 490"/>
  </g>
  <g fill="#F5F5FA">
    <circle cx="150" cy="120" r="3" opacity="0.8"/>
    <circle cx="420" cy="80" r="2" opacity="0.6"/>
    <circle cx="700" cy="150" r="2.5" opacity="0.5"/>
    <circle cx="260" cy="250" r="2" opacity="0.4"/>
  </g>
  <text x="80" y="330" font-family="Orbitron, Arial, sans-serif" font-size="66" font-weight="800"
        fill="#F5F5FA" opacity="0.92">${initials(label)}</text>
  <text x="80" y="390" font-family="Arial, sans-serif" font-size="26" letter-spacing="6"
        fill="#3FE3F5" opacity="0.85">TD BAKUGAN BLOG</text>
</svg>`;
  return toDataUri(svg);
}

/** Ảnh dùng cho banner/trang giới thiệu. */
export function bannerPlaceholder(label: string, index = 0): string {
  return blogPlaceholder(label, index + 7);
}

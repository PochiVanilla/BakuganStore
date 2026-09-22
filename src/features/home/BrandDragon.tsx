import { useEffect, useId, useState } from 'react';
import { DragonEmblem } from './DragonEmblem';

/** Ảnh huy hiệu rồng của shop. Xem hướng dẫn ở public/brand/README.md */
export const BRAND_DRAGON_SRC = '/brand/dragon.png';

type ProbeState = 'checking' | 'ready' | 'missing';

/**
 * Kiểm tra ảnh có tải được không trước khi dùng.
 *
 * Không dựa vào sự kiện onError của thẻ <image> trong SVG: khi thiếu file,
 * cấu hình SPA thường trả về index.html kèm mã 200 nên onError không chạy.
 * Tải thử bằng Image() thì nội dung HTML sẽ lỗi giải mã và báo đúng.
 */
function useImageProbe(src: string): ProbeState {
  const [state, setState] = useState<ProbeState>('checking');

  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setState(probe.naturalWidth > 0 ? 'ready' : 'missing');
    };
    probe.onerror = () => {
      if (!cancelled) setState('missing');
    };
    probe.src = src;

    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [src]);

  return state;
}

export interface BrandDragonProps {
  /** Màu tô cho hình vector dự phòng khi chưa có ảnh */
  fallbackFill: string;
  /** Bật lớp bóng loáng và khối nổi 3D */
  glossy?: boolean;
}

/**
 * Huy hiệu rồng của shop, vẽ bên trong một thẻ <svg> có sẵn (toạ độ 200×200).
 *
 * - Có ảnh ở `public/brand/dragon.png`: dùng đúng ảnh đó, giữ nguyên màu gốc,
 *   phủ thêm lớp bóng loáng và đổ bóng để nhìn nổi khối như vật thể thật.
 * - Chưa có ảnh: quay về hình rồng vector, trang không bao giờ trống.
 */
export function BrandDragon({ fallbackFill, glossy = true }: BrandDragonProps) {
  const probe = useImageProbe(BRAND_DRAGON_SRC);
  const uid = useId().replace(/:/g, '');
  const shapeMaskId = `bd-shape-${uid}`;
  const glossId = `bd-gloss-${uid}`;
  const rimId = `bd-rim-${uid}`;
  const depthId = `bd-depth-${uid}`;
  const sweepId = `bd-sweep-${uid}`;
  const specId = `bd-spec-${uid}`;
  const shadeId = `bd-shade-${uid}`;

  if (probe !== 'ready') {
    return <DragonEmblem fill={fallbackFill} />;
  }

  return (
    <>
      <defs>
        {/* Mặt nạ bám theo đúng hình huy hiệu: vùng sáng của ảnh là vùng hiện,
            nền trong suốt và các chỗ khoét hình rồng đều bị loại. */}
        <mask id={shapeMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <image
            href={BRAND_DRAGON_SRC}
            x="0"
            y="0"
            width="200"
            height="200"
            preserveAspectRatio="xMidYMid meet"
          />
        </mask>

        {/* Vệt bóng loáng phía trên trái, kiểu bề mặt men bóng */}
        <linearGradient id={glossId} x1="20%" y1="2%" x2="62%" y2="62%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="26%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Chấm sáng gắt, tạo cảm giác bề mặt men bóng phản chiếu */}
        <radialGradient id={specId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Bóng đổ bên trong ở mép dưới phải, cho khối tròn rõ hơn */}
        <radialGradient id={shadeId} cx="72%" cy="78%" r="58%">
          <stop offset="0%" stopColor="#0A0620" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#0A0620" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0A0620" stopOpacity="0" />
        </radialGradient>

        {/* Viền sáng hắt từ dưới lên, tạo cảm giác khối tròn */}
        <radialGradient id={rimId} cx="50%" cy="92%" r="62%">
          <stop offset="0%" stopColor="#3FE3F5" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#7B4BE8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Dải sáng quét ngang, chạy chậm cho bề mặt long lanh */}
        <linearGradient id={sweepId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Đổ bóng để huy hiệu nổi khỏi nền */}
        <filter id={depthId} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#05010F" floodOpacity="0.75" />
          <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor="#7B4BE8" floodOpacity="0.5" />
        </filter>
      </defs>

      <g filter={glossy ? `url(#${depthId})` : undefined}>
        {/* Ảnh gốc, giữ nguyên dải màu của thiết kế */}
        <image
          href={BRAND_DRAGON_SRC}
          x="0"
          y="0"
          width="200"
          height="200"
          preserveAspectRatio="xMidYMid meet"
        />

        {glossy && (
          <g mask={`url(#${shapeMaskId})`}>
            {/* Bóng tối dồn về mép dưới phải cho khối tròn */}
            <rect x="0" y="0" width="200" height="200" fill={`url(#${shadeId})`} />
            {/* Ánh sáng hắt lên từ phía dưới */}
            <rect x="0" y="0" width="200" height="200" fill={`url(#${rimId})`} />
            {/* Mảng bóng loáng trên bề mặt */}
            <ellipse cx="74" cy="54" rx="66" ry="44" fill={`url(#${glossId})`} />
            {/* Chấm sáng phản chiếu */}
            <ellipse
              cx="66"
              cy="44"
              rx="26"
              ry="16"
              fill={`url(#${specId})`}
              transform="rotate(-24 66 44)"
            />
            {/* Dải sáng quét qua theo chu kỳ */}
            <rect
              className="brand-dragon-sweep"
              x="-120"
              y="-40"
              width="90"
              height="280"
              fill={`url(#${sweepId})`}
              transform="rotate(18 100 100)"
            />
          </g>
        )}
      </g>
    </>
  );
}

import { useEffect, useId, useState } from 'react';
import { DragonEmblem } from './DragonEmblem';

/** Nơi đặt ảnh rồng của shop. Xem hướng dẫn ở public/brand/README.md */
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

/**
 * Hình rồng thương hiệu, vẽ bên trong một thẻ <svg> có sẵn.
 *
 * - Có ảnh ở `public/brand/dragon.png`: dùng ảnh đó qua một mặt nạ rồi tô
 *   bằng gradient neon, nên ảnh gốc màu gì cũng lên đúng tông thương hiệu.
 *   Mặt nạ xử lý được cả ảnh nền trắng lẫn ảnh PNG nền trong suốt.
 * - Chưa có ảnh: dùng hình rồng vector, trang không bao giờ trống.
 *
 * Toạ độ vẽ là 200×200 để khớp với DragonEmblem.
 */
export function BrandDragon({ fill }: { fill: string }) {
  const probe = useImageProbe(BRAND_DRAGON_SRC);
  const uid = useId().replace(/:/g, '');
  const maskId = `brand-dragon-mask-${uid}`;
  const cutoutId = `brand-dragon-cutout-${uid}`;

  if (probe !== 'ready') {
    return <DragonEmblem fill={fill} />;
  }

  return (
    <>
      <defs>
        <filter id={cutoutId} colorInterpolationFilters="sRGB">
          {/* Bước 1: đảo độ sáng vào kênh alpha — chỗ tối của ảnh (thân rồng)
              thành đục, chỗ sáng (nền trắng) thành trong suốt. */}
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    -0.33 -0.33 -0.33 0 1"
            result="inverted"
          />
          {/* Bước 2: giao với vùng đục của ảnh gốc, nhờ vậy ảnh PNG nền trong
              suốt không bị biến nền thành khối đặc. */}
          <feComposite in="inverted" in2="SourceGraphic" operator="in" />
        </filter>

        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <image
            href={BRAND_DRAGON_SRC}
            x="0"
            y="0"
            width="200"
            height="200"
            preserveAspectRatio="xMidYMid meet"
            filter={`url(#${cutoutId})`}
          />
        </mask>
      </defs>

      <rect x="0" y="0" width="200" height="200" fill={fill} mask={`url(#${maskId})`} />
    </>
  );
}

import type { ReactNode } from 'react';
import type { BakuganAttribute } from '@/types';
import { ATTRIBUTE_META } from '@/constants/catalog';
import { cn } from '@/utils/cn';

/**
 * Biểu tượng sáu hệ Bakugan, vẽ lại bằng vector theo mẫu ký hiệu quen thuộc
 * của cộng đồng: Pyrus (lửa), Aquos (nước), Subterra (đất), Haos (ánh sáng),
 * Darkus (bóng tối), Ventus (gió).
 *
 * Toàn bộ hình dùng `currentColor` nên chỉ cần đặt màu chữ là icon đổi theo hệ.
 * Khung nhìn chuẩn 64×64, tâm (32, 32).
 */

const ICONS: Record<BakuganAttribute, ReactNode> = {
  /* ---------- PYRUS — ba ngọn lửa trên vành cung ---------- */
  pyrus: (
    <>
      {/* Ngọn lửa trung tâm */}
      <path d="M32 6c3.6 9 7 16.6 7.4 24.2L32 24.6l-7.4 5.6C25 22.6 28.4 15 32 6Z" />
      {/* Vành cung dưới, khoét hình tam giác ở giữa */}
      <path d="M7.5 33a24.5 24.5 0 0 0 49 0h-9.6c-.5 6.8-6.6 13.6-14.9 4.4C23.7 46.6 17.6 39.8 17.1 33Z" />
      {/* Móng lửa bên trái */}
      <path d="M15.6 12.8C9.5 18.4 6 25.6 6 33.6c5-3.6 10-8.6 14.6-14.2a44 44 0 0 0-5-6.6Z" />
      {/* Móng lửa bên phải */}
      <path d="M48.4 12.8c6.1 5.6 9.6 12.8 9.6 20.8-5-3.6-10-8.6-14.6-14.2a44 44 0 0 1 5-6.6Z" />
    </>
  ),

  /* ---------- AQUOS — thấu kính nước giữa, hai lưỡi liềm có sừng ---------- */
  aquos: (
    <>
      {/* Thấu kính trung tâm, nhọn hai đầu */}
      <path d="M32 4.5c4 10.2 6 19.3 6 27.5s-2 17.3-6 27.5c-4-10.2-6-19.3-6-27.5s2-17.3 6-27.5Z" />
      {/* Lưỡi liềm trái */}
      <path d="M19.8 11C12.1 17.6 8 24.8 8 32s4.1 14.4 11.8 21c1.6-7.3 1-13-2.6-17.7-1.3-1.7-1.3-4.9 0-6.6C20.8 24 21.4 18.3 19.8 11Z" />
      {/* Lưỡi liềm phải */}
      <path d="M44.2 11C51.9 17.6 56 24.8 56 32s-4.1 14.4-11.8 21c-1.6-7.3-1-13 2.6-17.7 1.3-1.7 1.3-4.9 0-6.6C43.2 24 42.6 18.3 44.2 11Z" />
    </>
  ),

  /* ---------- SUBTERRA — vòng tròn bị chia tư bởi chữ thập ---------- */
  subterra: (
    <>
      {/* Thanh dọc và thanh ngang tạo chữ thập */}
      <path d="M28.4 3h7.2v58h-7.2Z" />
      <path d="M3 28.4h58v7.2H3Z" />
      {/* Bốn góc phần tư, chừa khe hở quanh chữ thập */}
      <path d="M7 26A25.7 25.7 0 0 1 26 7v19Z" />
      <path d="M38 7a25.7 25.7 0 0 1 19 19H38Z" />
      <path d="M57 38a25.7 25.7 0 0 1-19 19V38Z" />
      <path d="M26 57A25.7 25.7 0 0 1 7 38h19Z" />
    </>
  ),

  /* ---------- HAOS — ngôi sao năm cánh rời trong vành tròn ---------- */
  haos: (
    <>
      {/* Vành tròn */}
      <path
        fillRule="evenodd"
        d="M32 3a29 29 0 1 1 0 58 29 29 0 0 1 0-58Zm0 7a22 22 0 1 0 0 44 22 22 0 0 0 0-44Z"
      />
      {/* Năm cánh sao tách rời */}
      <path d="M32 13.4 36 26.6h-8Z" />
      <path d="M49.9 26.3 38.8 34.1 36.3 26.5Z" />
      <path d="M43.1 47.3 32.3 39.1l6.4-4.7Z" />
      <path d="M20.9 47.3 25.3 34.4l6.4 4.7Z" />
      <path d="M14.1 26.3 27.7 26.5l-2.5 7.6Z" />
      {/* Lõi trung tâm */}
      <path d="M32 27.6 36.1 34.8H27.9Z" />
    </>
  ),

  /* ---------- DARKUS — khiên mặt nạ có sừng, khoét nanh bên trong ---------- */
  darkus: (
    <path
      fillRule="evenodd"
      d="M14 3.6c4 7 5.4 11.9 5.2 16.1A19.6 19.6 0 0 1 32 15.2c5 0 9.5 1.8 12.8 4.5-.2-4.2 1.2-9.1 5.2-16.1C54.4 11 56.6 18.6 56.6 25.6c0 13.4-9.2 26.8-24.6 35.8C16.6 52.4 7.4 39 7.4 25.6c0-7 2.2-14.6 6.6-22ZM32 21.8c-4.4 0-8 1.7-10.3 4.6-1.5 3.1-1.9 6.7-1.4 10.4l4.8 9.2V32.3l3.6 5.3v11.3L32 53l3.3-4.1V37.6l3.6-5.3V46l4.8-9.2c.5-3.7.1-7.3-1.4-10.4-2.3-2.9-5.9-4.6-10.3-4.6Z"
    />
  ),

  /* ---------- VENTUS — luồng gió cuộn trong vành tròn ---------- */
  ventus: (
    <>
      {/* Vành tròn */}
      <path
        fillRule="evenodd"
        d="M32 3a29 29 0 1 1 0 58 29 29 0 0 1 0-58Zm0 6.4a22.6 22.6 0 1 0 0 45.2 22.6 22.6 0 0 0 0-45.2Z"
      />
      {/* Ba luồng gió nằm ngang, nhọn hai đầu */}
      <path d="M32 14.8c7.4 0 13.4 1.9 13.4 4.3S39.4 23.4 32 23.4s-13.4-1.9-13.4-4.3S24.6 14.8 32 14.8Z" />
      <path d="M32 27.7c8.8 0 16 1.9 16 4.3s-7.2 4.3-16 4.3-16-1.9-16-4.3 7.2-4.3 16-4.3Z" />
      <path d="M32 40.6c7.4 0 13.4 1.9 13.4 4.3s-6 4.3-13.4 4.3-13.4-1.9-13.4-4.3 6-4.3 13.4-4.3Z" />
    </>
  ),
};

export interface AttributeIconProps {
  attribute: BakuganAttribute;
  size?: number;
  /** Thêm quầng sáng neon quanh icon */
  glow?: boolean;
  className?: string;
  /** Có nhãn khi icon đứng một mình; bỏ trống khi cạnh nó đã có chữ */
  title?: string;
}

export function AttributeIcon({
  attribute,
  size = 20,
  glow = false,
  className,
  title,
}: AttributeIconProps) {
  const meta = ATTRIBUTE_META[attribute];

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn('shrink-0', className)}
      style={glow ? { filter: `drop-shadow(0 0 4px ${meta.color})` } : undefined}
    >
      {title && <title>{title}</title>}
      {ICONS[attribute]}
    </svg>
  );
}

/**
 * Huy hiệu rồng: hai vòng cung ôm ngoài như đôi cánh, ở giữa là con rồng
 * đang chồm lên. Vẽ dạng bóng đặc một màu nên đặt trên nền nào cũng rõ.
 *
 * Thân rồng là một đường liền từ mõm → cổ → lưng → đuôi → chân → bụng → hàm,
 * các chi tiết còn lại (sừng, vây, tay) chồng lên nên khi tô cùng một màu sẽ
 * liền thành một khối duy nhất.
 *
 * Toạ độ gốc 200×200, tâm (100, 100) — dùng lại được ở nhiều kích thước.
 */
export function DragonEmblem({
  fill = 'currentColor',
  /** Màu chấm mắt; để trống thì mắt là lỗ trống của bóng đặc */
  eyeFill = '#0A0A12',
  className,
}: {
  fill?: string;
  eyeFill?: string;
  className?: string;
}) {
  return (
    <g className={className} fill={fill}>
      {/* Vòng cung trái (cánh) */}
      <path d="M68.5 13.6A92 92 0 0 0 68.5 186.4L78 160A66 66 0 0 1 78 40Z" />
      {/* Vòng cung phải (cánh) */}
      <path d="M131.5 13.6A92 92 0 0 1 131.5 186.4L122 160A66 66 0 0 0 122 40Z" />

      {/* Thân rồng liền mạch */}
      <path d="M150 62c-8-10-14-18-22-20-10-4-20-2-28 4-12 10-20 24-24 40-4 18-4 32 0 46 2 6 4 10 6 14-12 12-26 26-40 42 14-8 26-18 36-30 4 8 8 16 14 24l6 8 16-6c-6-12-10-24-12-36-2-10 0-20 4-30 8 4 18 8 28 6l12-2-10-12c-10 4-20 2-28-6-4-10-4-20 0-28 8-6 18-8 28-4l10 4Z" />

      {/* Sừng chồm ra sau */}
      <path d="M106 44 86 20l16 18Z" />
      <path d="M116 40 104 14l20 20Z" />

      {/* Vây lưng */}
      <path d="M78 92 62 84l18-4Z" />
      <path d="M74 114 58 110l18-6Z" />
      <path d="M78 136 62 138l16-12Z" />

      {/* Vuốt tay trước */}
      <path d="M134 124l16-2-10 10Z" />

      {/* Bàn chân sau */}
      <path d="M92 182l24-4-2 12-24-2Z" />

      {/* Mắt */}
      <circle cx="126" cy="54" r="3.6" fill={eyeFill} />
    </g>
  );
}

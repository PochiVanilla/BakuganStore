import { useMemo } from 'react';

interface Star {
  id: number;
  top: string;
  left: string;
  size: number;
  delay: string;
  color: string;
}

const COLORS = ['#F5C542', '#3FE3F5', '#E940D2', '#F5F5FA'];

/** Nền sao lấp lánh — chi tiết trang trí theo logo, không chắn thao tác người dùng. */
export function StarField({ count = 28 }: { count?: number }) {
  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        top: `${(index * 37) % 100}%`,
        left: `${(index * 53) % 100}%`,
        size: index % 7 === 0 ? 3 : index % 3 === 0 ? 2 : 1.5,
        delay: `${(index % 9) * 0.4}s`,
        color: COLORS[index % COLORS.length]!,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute animate-twinkle rounded-full"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            backgroundColor: star.color,
            boxShadow: `0 0 ${star.size * 3}px ${star.color}`,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}

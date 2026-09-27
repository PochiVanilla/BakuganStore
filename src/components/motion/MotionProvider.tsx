import type { ReactNode } from 'react';
import { LazyMotion } from 'framer-motion';

const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default);

/**
 * Hiệu ứng chuyển động tải lười: các component dùng `m.div` (không phải
 * `motion.div`) nên lần tải đầu chỉ cần phần lõi rất nhỏ; phần tính hiệu ứng
 * tải ngay sau đó, trước khi khách kịp mở menu hay khung chat.
 * `strict` báo lỗi ngay khi lỡ dùng `motion.*` (sẽ kéo cả thư viện vào lại).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}

import type { ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { MotionProvider } from '@/components/motion/MotionProvider';

/** Gom mọi provider vào một chỗ — thêm React Query, i18n… sau này chỉ sửa file này. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HelmetProvider>
      <MotionProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </MotionProvider>
    </HelmetProvider>
  );
}

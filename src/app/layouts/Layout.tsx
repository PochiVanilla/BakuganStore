import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { StarField } from '@/components/layout/StarField';
import { MiniCart } from '@/features/cart/MiniCart';
import { ToastViewport } from '@/components/ui';
import { RouteFallback } from '../RouteFallback';

export default function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <StarField />
      <Header />
      <main id="main-content" className="flex-1 pt-32 md:pt-20 lg:pt-32 xl:pt-20">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MobileMenu />
      <MiniCart />
      <ToastViewport />
    </div>
  );
}

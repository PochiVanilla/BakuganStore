import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './layouts/Layout';
import { ScrollToTop } from './ScrollToTop';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { ROUTES } from '@/constants/routes';

/* Code-splitting theo route — mỗi trang là một chunk riêng, tải khi cần. */
const HomePage = lazy(() => import('@/pages/HomePage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const NewArrivalsPage = lazy(() => import('@/pages/NewArrivalsPage'));
const AuctionsPage = lazy(() => import('@/pages/AuctionsPage'));
const AuctionDetailPage = lazy(() => import('@/pages/AuctionDetailPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const BlogPage = lazy(() => import('@/pages/BlogPage'));
const BlogDetailPage = lazy(() => import('@/pages/BlogDetailPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const WishlistPage = lazy(() => import('@/pages/WishlistPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.products} element={<ProductsPage />} />
          <Route path={`${ROUTES.products}/:slug`} element={<ProductDetailPage />} />
          <Route path={ROUTES.newArrivals} element={<NewArrivalsPage />} />
          <Route path={ROUTES.auctions} element={<AuctionsPage />} />
          <Route path={`${ROUTES.auctions}/:id`} element={<AuctionDetailPage />} />
          <Route path={ROUTES.about} element={<AboutPage />} />
          <Route path={ROUTES.blog} element={<BlogPage />} />
          <Route path={`${ROUTES.blog}/:slug`} element={<BlogDetailPage />} />
          <Route path={ROUTES.contact} element={<ContactPage />} />
          <Route path={ROUTES.cart} element={<CartPage />} />
          <Route path={ROUTES.wishlist} element={<WishlistPage />} />
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.register} element={<RegisterPage />} />
          <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.terms} element={<LegalPage variant="terms" />} />
          <Route path={ROUTES.privacy} element={<LegalPage variant="privacy" />} />
          <Route path={ROUTES.shipping} element={<LegalPage variant="shipping" />} />
          <Route path={ROUTES.returns} element={<LegalPage variant="returns" />} />

          {/* Route cần đăng nhập — chưa đăng nhập sẽ bị đẩy về /dang-nhap */}
          <Route element={<ProtectedRoute />}>
            <Route path={ROUTES.account} element={<AccountPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}

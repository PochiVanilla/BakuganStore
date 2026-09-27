import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './layouts/Layout';
import { ScrollToTop } from './ScrollToTop';
import { RouteFallback } from './RouteFallback';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AdminRoute } from '@/features/admin/AdminRoute';
import { ADMIN_ROUTES, LEGACY_REDIRECTS, ROUTES } from '@/constants/routes';

/* Code-splitting theo route — mỗi trang là một chunk riêng, tải khi cần. */
const HomePage = lazy(() => import('@/pages/HomePage'));
const FeedsPage = lazy(() => import('@/pages/FeedsPage'));
const FeedDetailPage = lazy(() => import('@/pages/FeedDetailPage'));
const AuctionsPage = lazy(() => import('@/pages/AuctionsPage'));
const AuctionDetailPage = lazy(() => import('@/pages/AuctionDetailPage'));
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

/* Khu vực quản trị — tách chunk riêng, khách thường không bao giờ tải về. */
const AdminLayout = lazy(() => import('@/features/admin/AdminLayout'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/admin/OrderDetailPage'));
const CreateOrderPage = lazy(() => import('@/pages/admin/CreateOrderPage'));
const AuctionsAdminPage = lazy(() => import('@/pages/admin/AuctionsAdminPage'));
const FeedsAdminPage = lazy(() => import('@/pages/admin/FeedsAdminPage'));
const FeedEditorPage = lazy(() => import('@/pages/admin/FeedEditorPage'));
const ItemsAdminPage = lazy(() => import('@/pages/admin/ItemsAdminPage'));
const ProblemsPage = lazy(() => import('@/pages/admin/ProblemsPage'));
const CustomersPage = lazy(() => import('@/pages/admin/CustomersPage'));
const CustomerDetailPage = lazy(() => import('@/pages/admin/CustomerDetailPage'));
const ChatInboxPage = lazy(() => import('@/pages/admin/ChatInboxPage'));
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Quản trị: kiểm tra đăng nhập + quyền admin trước khi tải bất cứ trang nào */}
        <Route element={<AdminRoute />}>
          <Route
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route path={ADMIN_ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ADMIN_ROUTES.orders} element={<OrdersPage />} />
            <Route path={ADMIN_ROUTES.createOrder} element={<CreateOrderPage />} />
            <Route path={`${ADMIN_ROUTES.orders}/:id`} element={<OrderDetailPage />} />
            <Route path={ADMIN_ROUTES.auctions} element={<AuctionsAdminPage />} />
            <Route path={ADMIN_ROUTES.feeds} element={<FeedsAdminPage />} />
            <Route path={ADMIN_ROUTES.newFeed} element={<FeedEditorPage />} />
            <Route path={`${ADMIN_ROUTES.feeds}/:id`} element={<FeedEditorPage />} />
            <Route path={ADMIN_ROUTES.items} element={<ItemsAdminPage />} />
            {/* Trang cũ của cách bán theo số lượng */}
            <Route path="/admin/kho-hang" element={<Navigate to={ADMIN_ROUTES.items} replace />} />
            <Route path="/admin/nhap-hang" element={<Navigate to={ADMIN_ROUTES.feeds} replace />} />
            <Route path={ADMIN_ROUTES.problems} element={<ProblemsPage />} />
            <Route path={ADMIN_ROUTES.customers} element={<CustomersPage />} />
            <Route path={`${ADMIN_ROUTES.customers}/:id`} element={<CustomerDetailPage />} />
            <Route path={ADMIN_ROUTES.chat} element={<ChatInboxPage />} />
            <Route path={ADMIN_ROUTES.settings} element={<SettingsPage />} />
            <Route path={`${ADMIN_ROUTES.dashboard}/*`} element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route element={<Layout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.feeds} element={<FeedsPage />} />
          <Route path={`${ROUTES.feeds}/:number`} element={<FeedDetailPage />} />
          <Route path={ROUTES.auctions} element={<AuctionsPage />} />
          <Route path={`${ROUTES.auctions}/:id`} element={<AuctionDetailPage />} />
          {LEGACY_REDIRECTS.map((redirect) => (
            <Route
              key={redirect.from}
              path={redirect.from}
              element={<Navigate to={redirect.to} replace />}
            />
          ))}
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

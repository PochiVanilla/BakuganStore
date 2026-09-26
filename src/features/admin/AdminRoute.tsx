import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { Button, ButtonLink } from '@/components/ui';

/**
 * Chặn khu vực quản trị ở phía giao diện.
 *
 * Đây chỉ là lớp điều hướng cho tiện: quyền thật được kiểm tra lại ở từng API
 * (xem services/api/mockSession.ts — backend thật phải làm y như vậy).
 */
export function AdminRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }

  if (role !== 'admin') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-white/10 bg-surface p-8 text-center">
          <ShieldAlert size={36} className="mx-auto text-warning" aria-hidden="true" />
          <h1 className="mt-4 font-display text-xl font-bold text-text">
            Bạn không có quyền vào khu vực quản trị
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Trang này chỉ dành cho tài khoản quản trị của TD Bakugan. Nếu bạn là nhân viên, hãy đăng
            nhập bằng tài khoản được cấp quyền.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink to={ROUTES.home} variant="secondary">
              Về cửa hàng
            </ButtonLink>
            <Button
              variant="ghost"
              onClick={() => {
                signOut();
                navigate(ROUTES.login, { state: { from: location } });
              }}
            >
              Đăng nhập tài khoản khác
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <Outlet />;
}

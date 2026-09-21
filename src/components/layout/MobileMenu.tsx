import { NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { LogIn, LogOut, Package, Settings, UserPlus, ChevronRight } from 'lucide-react';
import { NAV_ITEMS, ROUTES, SHOP_INFO } from '@/constants/routes';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Drawer } from '@/components/ui';
import { cn } from '@/utils/cn';
import { SearchBox } from './SearchBox';

export function MobileMenu() {
  const location = useLocation();
  const isOpen = useUIStore((state) => state.isMobileMenuOpen);
  const closeMobileMenu = useUIStore((state) => state.closeMobileMenu);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const signOut = useAuthStore((state) => state.signOut);

  // Đóng menu mỗi khi điều hướng sang trang khác.
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  const itemClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors',
      isActive
        ? 'border border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
        : 'border border-transparent text-text-muted hover:bg-white/5 hover:text-text',
    );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={closeMobileMenu}
      title="Menu"
      side="left"
      widthClassName="max-w-xs"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/8 p-4">
          <SearchBox onNavigate={closeMobileMenu} />
        </div>

        <nav aria-label="Điều hướng di động" className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === ROUTES.home} className={itemClass}>
              {item.label}
              <ChevronRight size={15} aria-hidden="true" />
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/8 p-4">
          {isAuthenticated && user ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 pb-1 text-xs text-text-muted">
                Đang đăng nhập: <span className="font-semibold text-text">{user.fullName}</span>
              </p>
              <NavLink to={`${ROUTES.account}?tab=profile`} className={itemClass}>
                <span className="inline-flex items-center gap-2.5">
                  <Settings size={16} aria-hidden="true" />
                  Cài đặt tài khoản
                </span>
              </NavLink>
              <NavLink to={`${ROUTES.account}?tab=orders`} className={itemClass}>
                <span className="inline-flex items-center gap-2.5">
                  <Package size={16} aria-hidden="true" />
                  Đơn hàng của tôi
                </span>
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  closeMobileMenu();
                }}
                className="flex items-center gap-2.5 rounded-xl border border-danger/30 px-4 py-3 text-sm font-medium text-danger transition hover:bg-danger/10"
              >
                <LogOut size={16} aria-hidden="true" />
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <NavLink to={ROUTES.login} className={itemClass}>
                <span className="inline-flex items-center gap-2.5">
                  <LogIn size={16} aria-hidden="true" />
                  Đăng nhập
                </span>
              </NavLink>
              <NavLink
                to={ROUTES.register}
                className="flex items-center justify-center gap-2.5 rounded-xl gradient-cta px-4 py-3 text-sm font-semibold text-white"
              >
                <UserPlus size={16} aria-hidden="true" />
                Đăng ký thành viên
              </NavLink>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-text-muted">
            Hotline{' '}
            <a href={`tel:${SHOP_INFO.hotline.replace(/\s/g, '')}`} className="text-gold">
              {SHOP_INFO.hotline}
            </a>
          </p>
        </div>
      </div>
    </Drawer>
  );
}

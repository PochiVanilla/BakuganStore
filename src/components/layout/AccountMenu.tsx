import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircle2, Settings, Package, LogOut, LogIn, UserPlus, Gavel } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { useClickOutside } from '@/hooks/useClickOutside';

export function AccountMenu() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const signOut = useAuthStore((state) => state.signOut);

  const containerRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false), isOpen);

  const handleSignOut = (): void => {
    signOut();
    setIsOpen(false);
    toast.success('Đã đăng xuất', 'Hẹn gặp lại bạn ở trận đấu tiếp theo!');
    navigate(ROUTES.home);
  };

  const itemClass =
    'flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-muted transition-colors hover:bg-white/5 hover:text-text';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={isAuthenticated ? `Tài khoản của ${user?.fullName}` : 'Tài khoản'}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-2 p-2.5 text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
      >
        <UserCircle2 size={19} />
        {isAuthenticated && user && (
          <span className="hidden max-w-24 truncate text-sm font-medium text-text xl:block">
            {user.fullName.split(' ').slice(-1)[0]}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
          >
            {isAuthenticated && user ? (
              <>
                <div className="border-b border-white/8 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-text">{user.fullName}</p>
                  <p className="truncate text-xs text-text-muted">{user.email}</p>
                </div>
                <nav className="py-1.5">
                  <Link
                    to={`${ROUTES.account}?tab=profile`}
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                    className={itemClass}
                  >
                    <Settings size={16} aria-hidden="true" />
                    Cài đặt tài khoản
                  </Link>
                  <Link
                    to={`${ROUTES.account}?tab=orders`}
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                    className={itemClass}
                  >
                    <Package size={16} aria-hidden="true" />
                    Đơn hàng của tôi
                  </Link>
                  <Link
                    to={`${ROUTES.account}?tab=bids`}
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                    className={itemClass}
                  >
                    <Gavel size={16} aria-hidden="true" />
                    Lịch sử đấu giá
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className={`${itemClass} w-full border-t border-white/8 text-danger hover:text-danger`}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </nav>
              </>
            ) : (
              <nav className="py-1.5">
                <div className="border-b border-white/8 px-4 py-3">
                  <p className="text-sm font-semibold text-text">Chào chiến binh!</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Đăng nhập để đấu giá và theo dõi đơn hàng.
                  </p>
                </div>
                <Link
                  to={ROUTES.login}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className={itemClass}
                >
                  <LogIn size={16} aria-hidden="true" />
                  Đăng nhập
                </Link>
                <Link
                  to={ROUTES.register}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className={itemClass}
                >
                  <UserPlus size={16} aria-hidden="true" />
                  Đăng ký
                </Link>
              </nav>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

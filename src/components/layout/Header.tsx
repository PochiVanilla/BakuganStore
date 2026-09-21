import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Heart, Menu, ShoppingCart } from 'lucide-react';
import { NAV_ITEMS, ROUTES } from '@/constants/routes';
import { useCartStore, selectCartCount } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';
import { AccountMenu } from './AccountMenu';

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent-pink px-1 font-display text-[10px] font-bold text-white shadow-glow-pink">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const cartCount = useCartStore(selectCartCount);
  const openCartDrawer = useCartStore((state) => state.openDrawer);
  const wishlistCount = useWishlistStore((state) => state.productIds.length);
  const openMobileMenu = useUIStore((state) => state.openMobileMenu);

  useEffect(() => {
    const onScroll = (): void => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'relative whitespace-nowrap px-1 py-1.5 text-sm font-medium transition-colors',
      'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-gradient-to-r after:from-accent-cyan after:to-accent-pink after:transition-transform',
      isActive
        ? 'text-accent-cyan after:scale-x-100'
        : 'text-text-muted hover:text-text hover:after:scale-x-100',
    );

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-all duration-300',
        isScrolled
          ? 'border-white/10 bg-background/90 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl'
          : 'border-transparent bg-background/60 backdrop-blur-md',
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Bỏ qua điều hướng
      </a>

      <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={openMobileMenu}
          aria-label="Mở menu"
          className="rounded-xl border border-white/10 bg-surface-2 p-2.5 text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan lg:hidden"
        >
          <Menu size={19} />
        </button>

        <Logo />

        <nav aria-label="Điều hướng chính" className="ml-4 hidden items-center gap-5 xl:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.home}
              className={navLinkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden min-w-0 flex-1 justify-end px-2 md:flex lg:max-w-sm xl:max-w-md">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            to={ROUTES.wishlist}
            aria-label={`Yêu thích${wishlistCount > 0 ? ` (${wishlistCount} sản phẩm)` : ''}`}
            className="relative rounded-xl border border-white/10 bg-surface-2 p-2.5 text-text-muted transition hover:border-accent-pink/50 hover:text-accent-pink"
          >
            <Heart size={19} />
            <CountBadge count={wishlistCount} />
          </Link>

          <button
            type="button"
            onClick={openCartDrawer}
            aria-label={`Giỏ hàng${cartCount > 0 ? ` (${cartCount} sản phẩm)` : ''}`}
            className="relative rounded-xl border border-white/10 bg-surface-2 p-2.5 text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan"
          >
            <ShoppingCart size={19} />
            <CountBadge count={cartCount} />
          </button>

          <AccountMenu />
        </div>
      </div>

      {/* Ô tìm kiếm riêng cho mobile */}
      <div className="border-t border-white/5 px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      {/* Menu ngang rút gọn cho tablet */}
      <nav
        aria-label="Điều hướng nhanh"
        className="scrollbar-none hidden gap-5 overflow-x-auto border-t border-white/5 px-6 py-2.5 lg:flex xl:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === ROUTES.home}
            className={navLinkClass}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export default Header;

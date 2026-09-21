import { Heart, ShoppingCart, UserCircle2, Search, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Sản phẩm', to: '/san-pham' },
  { label: 'Hàng mới', to: '/hang-moi' },
  { label: 'Đấu giá', to: '/dau-gia' },
  { label: 'Giới thiệu', to: '/gioi-thieu' },
  { label: 'Blog', to: '/blog' },
  { label: 'Liên hệ', to: '/lien-he' },
];

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0A0A12]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button className="rounded-full border border-cyan-400/40 bg-surface p-2 text-cyan-300 lg:hidden" aria-label="Mở menu">
            <Menu size={18} />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent-pink/60 bg-white/5 text-lg font-black text-primary shadow-[0_0_18px_rgba(123,75,232,0.8)]">
              <span className="text-primary">TD</span>
            </div>
            <div className="text-left">
              <div className="text-lg font-black tracking-[0.12em] text-primary neon-text">TD</div>
              <div className="text-[10px] font-bold tracking-[0.38em] text-accent-cyan">BAKUGAN</div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium transition ${isActive ? 'text-text' : 'text-text-muted hover:text-text'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden flex-1 items-center justify-center px-4 md:flex">
          <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text-muted shadow-inner shadow-black/30">
            <Search size={16} className="text-accent-cyan" />
            <input
              aria-label="Tìm kiếm sản phẩm"
              className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
              placeholder="Tìm Bakugan, hệ Pyrus..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/yeu-thich" className="relative rounded-full border border-white/10 bg-surface p-2.5 text-text-muted transition hover:text-accent-cyan" aria-label="Yêu thích">
            <Heart size={18} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-pink px-1 text-[10px] font-bold text-white">
              3
            </span>
          </Link>
          <Link to="/gio-hang" className="relative rounded-full border border-white/10 bg-surface p-2.5 text-text-muted transition hover:text-gold" aria-label="Giỏ hàng">
            <ShoppingCart size={18} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-background">
              2
            </span>
          </Link>
          <Link to="/dang-nhap" className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-accent-cyan hover:text-accent-cyan" aria-label="Tài khoản">
            <UserCircle2 size={18} />
            <span className="hidden sm:inline">Tài khoản</span>
          </Link>
        </div>
      </div>

      <div className="border-t border-white/5 bg-surface/60 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text-muted">
          <Search size={16} className="text-accent-cyan" />
          <input
            aria-label="Tìm kiếm sản phẩm"
            className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
            placeholder="Tìm sản phẩm"
          />
        </div>
      </div>
    </header>
  );
}

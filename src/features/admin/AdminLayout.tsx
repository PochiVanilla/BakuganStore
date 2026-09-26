import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ExternalLink,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PackagePlus,
  PlusCircle,
  Settings,
  ShoppingBag,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import { getAdminBadges, type AdminBadges } from '@/services/api/admin';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { Drawer, ToastViewport } from '@/components/ui';
import { DragonMark } from '@/components/layout/DragonMark';
import { RouteFallback } from '@/app/RouteFallback';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: keyof AdminBadges;
  /** Chỉ sáng khi đúng đường dẫn (không sáng cho trang con) */
  end?: boolean;
}

const NAV_GROUPS: ReadonlyArray<{ title: string; items: readonly NavEntry[] }> = [
  {
    title: 'Tổng quan',
    items: [
      { to: ADMIN_ROUTES.dashboard, label: 'Bảng điều khiển', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'Bán hàng',
    items: [
      {
        to: ADMIN_ROUTES.orders,
        label: 'Đơn hàng',
        icon: ShoppingBag,
        badge: 'activeOrders',
        end: true,
      },
      { to: ADMIN_ROUTES.createOrder, label: 'Tạo đơn', icon: PlusCircle },
      {
        to: ADMIN_ROUTES.auctions,
        label: 'Đơn đấu giá',
        icon: Gavel,
        badge: 'awaitingAuctionOrders',
      },
      { to: ADMIN_ROUTES.problems, label: 'Huỷ & sự cố', icon: TriangleAlert, badge: 'openIssues' },
    ],
  },
  {
    title: 'Hàng hoá',
    items: [
      { to: ADMIN_ROUTES.inventory, label: 'Kho hàng', icon: Boxes, badge: 'stockAlerts' },
      { to: ADMIN_ROUTES.receipts, label: 'Nhập hàng', icon: PackagePlus },
    ],
  },
  {
    title: 'Khách hàng',
    items: [
      { to: ADMIN_ROUTES.customers, label: 'Khách hàng', icon: Users },
      { to: ADMIN_ROUTES.chat, label: 'Tin nhắn', icon: MessagesSquare, badge: 'waitingChats' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [{ to: ADMIN_ROUTES.settings, label: 'Cài đặt', icon: Settings }],
  },
];

function SidebarNav({ badges, onNavigate }: { badges?: AdminBadges; onNavigate?: () => void }) {
  return (
    <nav aria-label="Điều hướng quản trị" className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.18em] text-text-muted/70 uppercase">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const count = item.badge && badges ? badges[item.badge] : 0;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-accent-cyan/10 text-accent-cyan'
                          : 'text-text-muted hover:bg-white/5 hover:text-text',
                      )
                    }
                  >
                    <item.icon size={17} aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="rounded-md bg-accent-pink/15 px-1.5 py-px text-[11px] font-semibold text-accent-pink tabular-nums">
                        {count}
                        <span className="sr-only"> việc cần xử lý</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to={ADMIN_ROUTES.dashboard} className="flex items-center gap-2.5 px-5 py-4">
      <DragonMark size={36} />
      <span className="leading-tight">
        <span className="block font-display text-sm font-black tracking-wider text-text">
          TD BAKUGAN
        </span>
        <span className="block text-[11px] font-medium text-accent-cyan">Trang quản trị</span>
      </span>
    </Link>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const revision = useLiveRevision();
  const { data: badges } = useAsync(() => getAdminBadges(), [revision], { keepPreviousData: true });

  const handleSignOut = (): void => {
    signOut();
    toast.success('Đã đăng xuất khỏi trang quản trị');
    navigate(ROUTES.login);
  };

  return (
    <div className="min-h-screen bg-background text-text lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>

      {/* Thanh bên cố định trên màn hình lớn */}
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-white/8 bg-surface/70 lg:flex">
        <Brand />
        <SidebarNav badges={badges} />
      </aside>

      {/* Thanh bên dạng trượt trên điện thoại */}
      <Drawer
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        title="Quản trị TD Bakugan"
        side="left"
        widthClassName="max-w-72"
      >
        <SidebarNav badges={badges} onNavigate={() => setIsNavOpen(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/8 bg-background/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-text lg:hidden"
            aria-label="Mở menu quản trị"
          >
            <Menu size={20} />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm text-text-muted">
            Xin chào, <span className="font-semibold text-text">{user?.fullName}</span>
          </p>
          <Link
            to={ROUTES.home}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-muted transition hover:bg-white/5 hover:text-text sm:flex"
          >
            <ExternalLink size={15} aria-hidden="true" />
            Xem cửa hàng
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-danger transition hover:bg-danger/10"
          >
            <LogOut size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <ToastViewport />
    </div>
  );
}

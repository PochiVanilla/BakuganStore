import { useNavigate, useSearchParams } from 'react-router-dom';
import { Gavel, KeyRound, LogOut, MapPin, Package, UserCircle2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { Container, Seo } from '@/components/ui';
import { ProfileTab } from '@/features/account/ProfileTab';
import { AddressTab } from '@/features/account/AddressTab';
import { OrdersTab } from '@/features/account/OrdersTab';
import { BidHistoryTab } from '@/features/account/BidHistoryTab';
import { ChangePasswordTab } from '@/features/account/ChangePasswordTab';

const TABS = [
  { key: 'profile', label: 'Thông tin cá nhân', icon: UserCircle2 },
  { key: 'addresses', label: 'Sổ địa chỉ', icon: MapPin },
  { key: 'orders', label: 'Đơn hàng của tôi', icon: Package },
  { key: 'bids', label: 'Lịch sử đấu giá', icon: Gavel },
  { key: 'password', label: 'Đổi mật khẩu', icon: KeyRound },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const rawTab = searchParams.get('tab');
  const activeTab: TabKey = isTabKey(rawTab) ? rawTab : 'profile';

  const setTab = (tab: TabKey): void => {
    setSearchParams({ tab }, { replace: true });
  };

  const handleSignOut = (): void => {
    signOut();
    toast.success('Đã đăng xuất', 'Hẹn gặp lại bạn ở trận đấu tiếp theo!');
    navigate(ROUTES.home);
  };

  return (
    <>
      <Seo
        title="Tài khoản của tôi"
        description="Quản lý thông tin cá nhân, sổ địa chỉ, đơn hàng và lịch sử đấu giá tại TD Bakugan."
        path={ROUTES.account}
        noIndex
      />

      <Container className="py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
            Tài khoản của tôi
          </h1>
          {user && (
            <p className="mt-2 text-sm text-text-muted">
              Xin chào <span className="font-semibold text-text">{user.fullName}</span> ·{' '}
              {user.email}
            </p>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          {/* Điều hướng tab */}
          <nav aria-label="Mục tài khoản" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="scrollbar-none flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {TABS.map((tab) => (
                <li key={tab.key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setTab(tab.key)}
                    aria-current={activeTab === tab.key ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium whitespace-nowrap transition',
                      activeTab === tab.key
                        ? 'border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan'
                        : 'border-white/8 bg-surface/70 text-text-muted hover:border-white/20 hover:text-text',
                    )}
                  >
                    <tab.icon size={16} aria-hidden="true" />
                    {tab.label}
                  </button>
                </li>
              ))}
              <li className="shrink-0 lg:shrink lg:pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-danger/25 px-4 py-3 text-sm font-medium whitespace-nowrap text-danger transition hover:bg-danger/10"
                >
                  <LogOut size={16} aria-hidden="true" />
                  Đăng xuất
                </button>
              </li>
            </ul>
          </nav>

          {/* Nội dung tab */}
          <div className="min-w-0 rounded-2xl border border-white/8 bg-surface/60 p-6 sm:p-8">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'addresses' && <AddressTab />}
            {activeTab === 'orders' && <OrdersTab />}
            {activeTab === 'bids' && <BidHistoryTab />}
            {activeTab === 'password' && <ChangePasswordTab />}
          </div>
        </div>
      </Container>
    </>
  );
}

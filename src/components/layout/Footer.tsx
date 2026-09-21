import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  MapPin,
  Phone,
  Clock,
  Send,
  MessageCircle,
  Globe,
  ShieldCheck,
  Truck,
  RefreshCw,
} from 'lucide-react';
import { NAV_ITEMS, ROUTES, SHOP_INFO } from '@/constants/routes';
import { subscribeNewsletter } from '@/services/api/contactService';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Container } from '@/components/ui';
import { Logo } from './Logo';

const POLICY_LINKS = [
  { label: 'Chính sách đổi trả', to: ROUTES.returns },
  { label: 'Chính sách vận chuyển', to: ROUTES.shipping },
  { label: 'Chính sách bảo mật', to: ROUTES.privacy },
  { label: 'Điều khoản sử dụng', to: ROUTES.terms },
];

const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://facebook.com', icon: Globe },
  { label: 'Zalo', href: SHOP_INFO.zaloUrl, icon: MessageCircle },
  { label: 'Messenger', href: SHOP_INFO.messengerUrl, icon: Send },
];

const COMMITMENTS = [
  { icon: ShieldCheck, label: 'Hàng chính hãng 100%' },
  { icon: Truck, label: 'Giao nhanh toàn quốc' },
  { icon: RefreshCw, label: 'Đổi trả trong 7 ngày' },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email chưa hợp lệ', 'Vui lòng kiểm tra lại địa chỉ email của bạn.');
      return;
    }
    setIsSubmitting(true);
    try {
      await subscribeNewsletter(email);
      toast.success('Đăng ký nhận tin thành công', 'Bạn sẽ nhận thông báo khi có hàng mới về.');
      setEmail('');
    } catch (error) {
      toast.error('Đăng ký thất bại', getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="relative mt-20 border-t border-white/8 bg-surface/50">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent-cyan/50 to-transparent" />

      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Thông tin shop */}
          <div className="lg:col-span-4">
            <Logo size="lg" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-muted">
              {SHOP_INFO.name} chuyên cung cấp Bakugan chính hãng, hàng sưu tầm hiếm và tổ chức các
              phiên đấu giá dành cho cộng đồng người chơi Việt Nam.
            </p>

            <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
                <span>{SHOP_INFO.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={16} className="shrink-0 text-accent-cyan" aria-hidden="true" />
                <a
                  href={`tel:${SHOP_INFO.hotline.replace(/\s/g, '')}`}
                  className="transition hover:text-gold"
                >
                  {SHOP_INFO.hotline}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="shrink-0 text-accent-cyan" aria-hidden="true" />
                <a href={`mailto:${SHOP_INFO.email}`} className="transition hover:text-gold">
                  {SHOP_INFO.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock size={16} className="shrink-0 text-accent-cyan" aria-hidden="true" />
                <span>{SHOP_INFO.workingHours}</span>
              </li>
            </ul>
          </div>

          {/* Liên kết nhanh */}
          <nav className="lg:col-span-2" aria-label="Liên kết nhanh">
            <h2 className="mb-4 font-display text-sm font-bold tracking-wider text-text">
              LIÊN KẾT NHANH
            </h2>
            <ul className="space-y-2.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-text-muted transition hover:text-accent-cyan"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Chính sách */}
          <nav className="lg:col-span-3" aria-label="Chính sách">
            <h2 className="mb-4 font-display text-sm font-bold tracking-wider text-text">
              CHÍNH SÁCH
            </h2>
            <ul className="space-y-2.5">
              {POLICY_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-text-muted transition hover:text-accent-cyan"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="mt-6 space-y-2">
              {COMMITMENTS.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-xs text-text-muted">
                  <item.icon size={14} className="text-gold" aria-hidden="true" />
                  {item.label}
                </li>
              ))}
            </ul>
          </nav>

          {/* Đăng ký nhận tin */}
          <div className="lg:col-span-3">
            <h2 className="mb-4 font-display text-sm font-bold tracking-wider text-text">
              ĐĂNG KÝ NHẬN TIN
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              Nhận thông báo hàng mới về và lịch mở phiên đấu giá sớm nhất.
            </p>

            <form onSubmit={handleSubscribe} className="flex flex-col gap-2.5">
              <label htmlFor="newsletter-email" className="sr-only">
                Địa chỉ email nhận tin
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@cua-ban.com"
                required
                className="h-11 rounded-xl border border-white/10 bg-surface-2 px-4 text-sm text-text transition outline-none placeholder:text-text-muted/60 focus:border-accent-cyan focus:shadow-[0_0_0_3px_rgba(63,227,245,0.14)]"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl gradient-cta text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Send size={15} aria-hidden="true" />
                {isSubmitting ? 'Đang gửi…' : 'Đăng ký nhận tin'}
              </button>
            </form>

            <div className="mt-6">
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-text-muted">
                KẾT NỐI VỚI SHOP
              </h3>
              <ul className="flex items-center gap-2.5">
                {SOCIAL_LINKS.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={social.label}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-surface-2 text-text-muted transition hover:border-accent-cyan/50 hover:text-accent-cyan hover:shadow-glow-cyan"
                    >
                      <social.icon size={17} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/8">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-center text-xs text-text-muted sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} {SHOP_INFO.name}. Toàn bộ sản phẩm là hàng sưu tầm, không
            liên kết chính thức với nhà sản xuất.
          </p>
          <p>Thiết kế &amp; phát triển tại Việt Nam 🇻🇳</p>
        </Container>
      </div>
    </footer>
  );
}

export default Footer;

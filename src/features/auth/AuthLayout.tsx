import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Container } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Nội dung cột trái trên desktop */
  aside?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer, aside }: AuthLayoutProps) {
  return (
    <Container className="py-10 sm:py-16">
      <Link
        to={ROUTES.home}
        className="mb-6 inline-flex items-center gap-2 text-sm text-text-muted transition hover:text-accent-cyan"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Về trang chủ
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="hidden lg:block">
          <div className="sticky top-28 overflow-hidden rounded-3xl border border-white/8 bg-surface/70 p-8">
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-gold/15 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <Logo size="lg" />
              {aside}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:mx-0">
          <div className="mb-7 lg:hidden">
            <Logo size="md" />
          </div>

          <h1 className="font-display text-2xl font-extrabold text-text sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-text-muted">{subtitle}</p>

          <div className="mt-7 rounded-2xl border border-white/8 bg-surface/80 p-6 sm:p-7">
            {children}
          </div>

          {footer && <div className="mt-5 text-center text-sm text-text-muted">{footer}</div>}
        </div>
      </div>
    </Container>
  );
}

import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Logo TD Bakugan: chữ "TD" tím viền hồng/cyan, "BAKUGAN" cyan phát sáng,
 * mặt trăng khuyết vàng và ngôi sao lấp lánh trên nền đen.
 */
export function Logo({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: { mark: 'h-9 w-9', td: 'text-base', name: 'text-[8px] tracking-[0.3em]' },
    md: { mark: 'h-11 w-11', td: 'text-xl', name: 'text-[10px] tracking-[0.34em]' },
    lg: { mark: 'h-14 w-14', td: 'text-2xl', name: 'text-xs tracking-[0.38em]' },
  }[size];

  return (
    <Link
      to={ROUTES.home}
      className={cn('group flex shrink-0 items-center gap-2.5', className)}
      aria-label="TD Bakugan — về trang chủ"
    >
      <span
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-xl border border-accent-pink/50 bg-background transition-shadow duration-300',
          'shadow-[0_0_16px_-4px_rgba(233,64,210,0.8)] group-hover:shadow-[0_0_22px_-2px_rgba(63,227,245,0.9)]',
          sizes.mark,
        )}
        aria-hidden="true"
      >
        {/* Mặt trăng khuyết vàng */}
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gold/80 blur-[1px]" />
        <span className="absolute -top-2 -right-2.5 h-5 w-5 rounded-full bg-background" />
        {/* Ngôi sao lấp lánh */}
        <span className="absolute bottom-1 left-1 h-1 w-1 animate-[twinkle_3.2s_ease-in-out_infinite] rounded-full bg-accent-cyan" />
        <span className="absolute bottom-2.5 left-2.5 h-0.5 w-0.5 rounded-full bg-text/70" />
        <span
          className={cn(
            'relative font-display font-black text-primary-soft neon-text-pink',
            sizes.td,
          )}
        >
          TD
        </span>
      </span>

      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display font-black text-primary-soft neon-text-pink',
            size === 'lg' ? 'text-xl' : size === 'md' ? 'text-lg' : 'text-base',
          )}
        >
          TD
        </span>
        <span className={cn('mt-1 font-display font-bold text-accent-cyan neon-text', sizes.name)}>
          BAKUGAN
        </span>
      </span>
    </Link>
  );
}

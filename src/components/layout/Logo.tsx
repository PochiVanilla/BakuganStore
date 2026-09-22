import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { DragonMark } from './DragonMark';

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
    sm: { name: 'text-[8px] tracking-[0.3em]' },
    md: { name: 'text-[10px] tracking-[0.34em]' },
    lg: { name: 'text-xs tracking-[0.38em]' },
  }[size];

  return (
    <Link
      to={ROUTES.home}
      className={cn('group flex shrink-0 items-center gap-2.5', className)}
      aria-label="TD Bakugan — về trang chủ"
    >
      <DragonMark
        size={size === 'lg' ? 56 : size === 'md' ? 44 : 36}
        className={cn(
          'transition-transform duration-300 group-hover:scale-105',
          size === 'lg' ? 'drop-shadow-[0_0_14px_rgba(233,64,210,0.6)]' : '',
        )}
      />

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

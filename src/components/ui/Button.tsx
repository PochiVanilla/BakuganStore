import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'gradient-cta text-white shadow-[0_0_20px_-4px_rgba(233,64,210,0.6)] hover:shadow-[0_0_28px_-2px_rgba(233,64,210,0.85)] hover:brightness-110',
  secondary:
    'bg-surface-2 text-text border border-white/10 hover:border-accent-cyan/60 hover:shadow-glow-cyan',
  ghost: 'bg-transparent text-text-muted hover:bg-white/5 hover:text-text',
  outline:
    'border border-accent-cyan/50 text-accent-cyan bg-accent-cyan/5 hover:bg-accent-cyan/15 hover:shadow-glow-cyan',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
  gold: 'bg-gold text-background font-bold hover:brightness-110 hover:shadow-glow-gold',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
};

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

function baseClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100',
    'active:scale-[0.98]',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    children,
    className,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={baseClasses(variant, size, fullWidth, className)}
      {...rest}
    >
      {isLoading ? (
        <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});

type ButtonLinkProps = BaseProps & Omit<LinkProps, 'className' | 'children'>;

/** Nút nhưng render ra <Link> — giữ đúng ngữ nghĩa điều hướng cho screen reader. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link to={to} className={baseClasses(variant, size, fullWidth, className)} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}

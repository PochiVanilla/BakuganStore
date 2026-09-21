import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff, CircleAlert } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, error, hint, required, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span className="ml-1 text-accent-pink" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const CONTROL_CLASSES =
  'w-full rounded-xl border bg-surface-2/80 px-4 text-text placeholder:text-text-muted/60 transition-colors outline-none';

function controlState(hasError: boolean): string {
  return hasError
    ? 'border-danger/70 focus:border-danger focus:shadow-[0_0_0_3px_rgba(255,92,122,0.18)]'
    : 'border-white/10 hover:border-white/20 focus:border-accent-cyan focus:shadow-[0_0_0_3px_rgba(63,227,245,0.16)]';
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, containerClassName, required, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = rest.name ? `field-${rest.name}` : generatedId;

  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        {leftIcon && (
          <span
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            CONTROL_CLASSES,
            'h-12',
            controlState(Boolean(error)),
            leftIcon && 'pl-11',
            className,
          )}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Nội dung phụ hiển thị ngay dưới ô (VD: thanh độ mạnh mật khẩu). */
  footer?: ReactNode;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, hint, footer, className, required, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const id = rest.name ? `field-${rest.name}` : generatedId;

    return (
      <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(CONTROL_CLASSES, 'h-12 pr-12', controlState(Boolean(error)), className)}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-accent-cyan"
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {footer}
      </FieldShell>
    );
  },
);

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, required, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = rest.name ? `field-${rest.name}` : generatedId;

  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(
          CONTROL_CLASSES,
          'min-h-32 py-3 leading-relaxed',
          controlState(Boolean(error)),
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SelectProps extends Omit<InputHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, className, required, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = rest.name ? `field-${rest.name}` : generatedId;

  return (
    <FieldShell id={id} label={label} error={error} required={required}>
      <select
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        className={cn(
          CONTROL_CLASSES,
          'h-12 cursor-pointer',
          controlState(Boolean(error)),
          className,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface-2">
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = rest.name ? `field-${rest.name}` : generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2.5">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-white/25 bg-surface-2',
            'accent-[#7B4BE8] transition-colors hover:border-accent-cyan/70',
            error && 'border-danger/70',
            className,
          )}
          {...rest}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-text-muted">
          {label}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

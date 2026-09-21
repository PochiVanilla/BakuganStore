import { Check, X } from 'lucide-react';
import { evaluatePasswordStrength } from './schemas';
import { cn } from '@/utils/cn';

const BAR_COLORS: Record<number, string> = {
  0: 'bg-white/10',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-accent-cyan',
  4: 'bg-success',
};

const TEXT_COLORS: Record<number, string> = {
  0: 'text-text-muted',
  1: 'text-danger',
  2: 'text-warning',
  3: 'text-accent-cyan',
  4: 'text-success',
};

const RULES: ReadonlyArray<{ key: 'length' | 'upper' | 'lower' | 'number'; label: string }> = [
  { key: 'length', label: 'Tối thiểu 8 ký tự' },
  { key: 'upper', label: 'Có chữ in hoa' },
  { key: 'lower', label: 'Có chữ thường' },
  { key: 'number', label: 'Có chữ số' },
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = evaluatePasswordStrength(password);

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                step <= strength.score ? BAR_COLORS[strength.score] : 'bg-white/10',
              )}
            />
          ))}
        </div>
        <span
          className={cn('min-w-20 text-right text-xs font-semibold', TEXT_COLORS[strength.score])}
        >
          {strength.label}
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        Độ mạnh mật khẩu: {strength.label}
      </p>

      <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {RULES.map((rule) => {
          const passed = strength.checks[rule.key];
          return (
            <li
              key={rule.key}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                passed ? 'text-success' : 'text-text-muted',
              )}
            >
              {passed ? (
                <Check size={12} className="shrink-0" aria-hidden="true" />
              ) : (
                <X size={12} className="shrink-0 opacity-50" aria-hidden="true" />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

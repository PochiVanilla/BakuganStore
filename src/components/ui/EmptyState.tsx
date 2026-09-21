import type { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-surface/50 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl border border-white/10 bg-surface-2 p-4 text-text-muted">
        {icon ?? <PackageOpen size={28} aria-hidden="true" />}
      </div>
      <h3 className="font-display text-lg font-bold text-text">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';
import { useUIStore, type Toast as ToastModel, type ToastVariant } from '@/store/uiStore';
import { cn } from '@/utils/cn';

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-success/40 bg-success/10 text-success',
  error: 'border-danger/40 bg-danger/10 text-danger',
  info: 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan',
};

const VARIANT_ICONS: Record<ToastVariant, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

function ToastItem({ toast }: { toast: ToastModel }) {
  const dismissToast = useUIStore((state) => state.dismissToast);
  const Icon = VARIANT_ICONS[toast.variant];

  useEffect(() => {
    const id = window.setTimeout(() => dismissToast(toast.id), 4500);
    return () => window.clearTimeout(id);
  }, [toast.id, dismissToast]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto w-full max-w-sm rounded-xl border border-white/10 bg-surface-2/95 p-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn('rounded-lg border p-1.5', VARIANT_STYLES[toast.variant])}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{toast.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismissToast(toast.id)}
          aria-label="Đóng thông báo"
          className="rounded-md p-1 text-text-muted transition hover:bg-white/5 hover:text-text"
        >
          <X size={14} />
        </button>
      </div>
    </motion.li>
  );
}

export function ToastViewport() {
  const toasts = useUIStore((state) => state.toasts);

  return createPortal(
    <ul
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed top-20 right-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5 sm:right-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </ul>,
    document.body,
  );
}

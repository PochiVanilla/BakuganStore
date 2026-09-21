import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  side = 'right',
  children,
  footer,
  widthClassName = 'max-w-md',
}: DrawerProps) {
  useLockBodyScroll(isOpen);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90]">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Đóng bảng trượt"
            className="absolute inset-0 h-full w-full cursor-default bg-background/80 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'tween', duration: 0.26, ease: 'easeOut' }}
            className={cn(
              'absolute top-0 flex h-full w-full flex-col border-white/10 bg-surface shadow-[0_0_60px_rgba(0,0,0,0.6)]',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              widthClassName,
            )}
          >
            <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h2 className="font-display text-base font-bold text-text">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-text"
              >
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <footer className="border-t border-white/8 p-5">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

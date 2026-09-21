import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface UIState {
  toasts: Toast[];
  isMobileMenuOpen: boolean;
  pushToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  isMobileMenuOpen: false,

  pushToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  openMobileMenu: () => set({ isMobileMenuOpen: true }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
}));

/** Helper gọi toast từ bất kỳ đâu, kể cả ngoài component. */
export const toast = {
  success: (title: string, description?: string) =>
    useUIStore.getState().pushToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useUIStore.getState().pushToast({ title, description, variant: 'error' }),
  info: (title: string, description?: string) =>
    useUIStore.getState().pushToast({ title, description, variant: 'info' }),
};

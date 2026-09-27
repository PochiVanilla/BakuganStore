import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

/** Yêu cầu mở khung chat từ nơi khác (VD nút "Tư vấn chọn Bakugan" ở trang chủ). */
export interface ChatRequest {
  id: number;
  /** Gửi luôn câu này cho trợ lý */
  send?: string;
  /** Chỉ điền sẵn vào ô nhập để khách viết tiếp */
  prefill?: string;
}

interface UIState {
  toasts: Toast[];
  isMobileMenuOpen: boolean;
  chatRequest: ChatRequest | null;
  openChat: (request?: Omit<ChatRequest, 'id'>) => void;
  clearChatRequest: (id: number) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  isMobileMenuOpen: false,
  chatRequest: null,

  openChat: (request = {}) =>
    set((state) => ({ chatRequest: { ...request, id: (state.chatRequest?.id ?? 0) + 1 } })),
  clearChatRequest: (id) =>
    set((state) => (state.chatRequest?.id === id ? { chatRequest: null } : state)),

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

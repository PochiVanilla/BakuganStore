import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Address, AuthSession, User } from '@/types';
import { AUTH_TOKEN_KEY } from '@/services/api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
  updateUser: (patch: Partial<User>) => void;
  upsertAddress: (address: Address) => void;
  removeAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
}

function syncToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // localStorage có thể bị chặn — state trong bộ nhớ vẫn hoạt động.
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      signIn: (session) => {
        syncToken(session.accessToken);
        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: true,
        });
      },

      signOut: () => {
        syncToken(null);
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      updateUser: (patch) =>
        set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),

      upsertAddress: (address) =>
        set((state) => {
          if (!state.user) return state;
          const exists = state.user.addresses.some((item) => item.id === address.id);
          const addresses = exists
            ? state.user.addresses.map((item) => (item.id === address.id ? address : item))
            : [...state.user.addresses, address];
          const normalized = address.isDefault
            ? addresses.map((item) => ({ ...item, isDefault: item.id === address.id }))
            : addresses;
          return { user: { ...state.user, addresses: normalized } };
        }),

      removeAddress: (addressId) =>
        set((state) =>
          state.user
            ? {
                user: {
                  ...state.user,
                  addresses: state.user.addresses.filter((item) => item.id !== addressId),
                },
              }
            : state,
        ),

      setDefaultAddress: (addressId) =>
        set((state) =>
          state.user
            ? {
                user: {
                  ...state.user,
                  addresses: state.user.addresses.map((item) => ({
                    ...item,
                    isDefault: item.id === addressId,
                  })),
                },
              }
            : state,
        ),
    }),
    {
      name: 'td-bakugan:auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Đồng bộ lại token cho axios interceptor sau khi tải lại trang.
        if (state?.accessToken) syncToken(state.accessToken);
      },
    },
  ),
);

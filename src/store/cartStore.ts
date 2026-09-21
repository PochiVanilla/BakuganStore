import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, Coupon, Product } from '@/types';

interface CartState {
  items: CartItem[];
  coupon: Coupon | null;
  isDrawerOpen: boolean;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  setCoupon: (coupon: Coupon | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

function toCartItem(product: Product, quantity: number): CartItem {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images[0] ?? '',
    price: product.price,
    originalPrice: product.originalPrice,
    attribute: product.attribute,
    condition: product.condition,
    quantity,
    maxQuantity: Math.max(1, product.stock),
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      isDrawerOpen: false,

      addItem: (product, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((item) => item.productId === product.id);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.productId === product.id
                  ? {
                      ...item,
                      quantity: Math.min(item.maxQuantity, item.quantity + quantity),
                    }
                  : item,
              ),
            };
          }
          return { items: [...state.items, toCartItem(product, quantity)] };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              item.productId === productId
                ? { ...item, quantity: Math.min(item.maxQuantity, Math.max(0, quantity)) }
                : item,
            )
            .filter((item) => item.quantity > 0),
        })),

      clear: () => set({ items: [], coupon: null }),
      setCoupon: (coupon) => set({ coupon }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
    }),
    {
      name: 'td-bakugan:cart',
      storage: createJSONStorage(() => localStorage),
      // Không lưu trạng thái mở/đóng drawer vào localStorage.
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    },
  ),
);

/* ---- Selector tách riêng để component chỉ re-render khi phần mình dùng đổi ---- */
export const selectCartCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartSubtotal = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

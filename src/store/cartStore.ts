import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BakuganAttribute, BakuganItem, CartItem, Coupon, ProductCondition } from '@/types';
import { ATTRIBUTE_META, CONDITION_LABELS } from '@/constants/catalog';

interface CartState {
  items: CartItem[];
  coupon: Coupon | null;
  isDrawerOpen: boolean;
  /** Thêm một con vào giỏ. Mỗi con là duy nhất nên thêm lại không có tác dụng. */
  addItem: (item: BakuganItem) => void;
  removeItem: (itemId: string) => void;
  /** Bỏ những con đã có người khác chốt trước */
  removeMany: (itemIds: readonly string[]) => void;
  clear: () => void;
  setCoupon: (coupon: Coupon | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

function toCartItem(item: BakuganItem): CartItem {
  return {
    itemId: item.id,
    code: item.code,
    name: item.name,
    image: item.image,
    price: item.price,
    attribute: item.attribute,
    condition: item.condition,
    feedNumber: item.feedNumber,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      isDrawerOpen: false,

      addItem: (item) =>
        set((state) =>
          state.items.some((entry) => entry.itemId === item.id)
            ? state
            : { items: [...state.items, toCartItem(item)] },
        ),

      removeItem: (itemId) =>
        set((state) => ({ items: state.items.filter((item) => item.itemId !== itemId) })),

      removeMany: (itemIds) =>
        set((state) => ({ items: state.items.filter((item) => !itemIds.includes(item.itemId)) })),

      clear: () => set({ items: [], coupon: null }),
      setCoupon: (coupon) => set({ coupon }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
    }),
    {
      name: 'td-bakugan:cart',
      storage: createJSONStorage(() => localStorage),
      /*
       * Bản 1 lưu theo "mẫu sản phẩm + số lượng" — bỏ đi khi chuyển sang bán theo từng con.
       * Bản 2 còn ảnh minh hoạ tự vẽ trong giỏ — bỏ ảnh đó (web không còn vẽ ảnh nữa).
       * Bản 3 lưu hệ / tình trạng dạng mã ("pyrus", "like-new") — đổi sang chữ như shop gõ.
       */
      version: 4,
      migrate: (persisted, version) => {
        if (version < 2) return { items: [], coupon: null };
        const state = persisted as Pick<CartState, 'items' | 'coupon'>;
        return {
          ...state,
          items: (state.items ?? []).map((item) => ({
            ...item,
            image: item.image.startsWith('data:') ? '' : item.image,
            attribute: ATTRIBUTE_META[item.attribute as BakuganAttribute]?.label ?? item.attribute,
            condition:
              CONDITION_LABELS[item.condition as ProductCondition] ?? item.condition ?? undefined,
          })),
        };
      },
      // Không lưu trạng thái mở/đóng drawer vào localStorage.
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    },
  ),
);

/* ---- Selector tách riêng để component chỉ re-render khi phần mình dùng đổi ---- */
export const selectCartCount = (state: CartState): number => state.items.length;

export const selectCartSubtotal = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.price, 0);

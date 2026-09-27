import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Những con Bakugan khách đánh dấu yêu thích (theo id từng con). */
interface WishlistState {
  itemIds: string[];
  toggle: (itemId: string) => void;
  remove: (itemId: string) => void;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      itemIds: [],

      toggle: (itemId) =>
        set((state) => ({
          itemIds: state.itemIds.includes(itemId)
            ? state.itemIds.filter((id) => id !== itemId)
            : [itemId, ...state.itemIds],
        })),

      remove: (itemId) =>
        set((state) => ({ itemIds: state.itemIds.filter((id) => id !== itemId) })),

      clear: () => set({ itemIds: [] }),
    }),
    {
      name: 'td-bakugan:wishlist',
      storage: createJSONStorage(() => localStorage),
      // Bản 1 lưu id "mẫu sản phẩm" cũ — không còn dùng được.
      version: 2,
      migrate: () => ({ itemIds: [] }),
    },
  ),
);

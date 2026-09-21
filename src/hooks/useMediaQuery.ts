import { useCallback, useSyncExternalStore } from 'react';

/**
 * Theo dõi media query bằng useSyncExternalStore — không cần setState
 * trong effect, tránh render thừa và luôn đồng bộ với trình duyệt.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1024px)');

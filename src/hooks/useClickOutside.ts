import { useEffect, useRef, type RefObject } from 'react';
import { useLatestRef } from './useLatestRef';

/** Gọi handler khi click ra ngoài phần tử hoặc nhấn Escape. */
export function useClickOutside<T extends HTMLElement>(
  handler: () => void,
  enabled = true,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const handlerRef = useLatestRef(handler);

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: MouseEvent | TouchEvent): void => {
      const element = ref.current;
      if (element && !element.contains(event.target as Node)) handlerRef.current();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') handlerRef.current();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, handlerRef]);

  return ref;
}

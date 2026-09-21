import { useEffect, useRef, type RefObject } from 'react';

/**
 * Giữ giá trị mới nhất trong một ref mà không gây re-render.
 * Ref được cập nhật trong effect (không phải khi render) để tuân thủ
 * quy tắc của React Compiler về tính thuần khiết khi render.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

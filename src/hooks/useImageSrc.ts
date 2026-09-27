import { useEffect, useState } from 'react';
import { IDB_PREFIX, resolveImageRef } from '@/services/api/imageStore';

/**
 * Ảnh admin tải lên ở chế độ mock nằm trong IndexedDB (mã "idb:…") nên cần
 * đọc bất đồng bộ; URL / đường dẫn / data-URI thường thì trả về ngay.
 */
export function useImageSrc(ref: string | undefined): string | undefined {
  const needsLookup = Boolean(ref?.startsWith(IDB_PREFIX));
  const [resolved, setResolved] = useState<{ ref: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!ref || !needsLookup) return;
    let cancelled = false;
    void resolveImageRef(ref).then((url) => {
      if (!cancelled) setResolved({ ref, url });
    });
    return () => {
      cancelled = true;
    };
  }, [ref, needsLookup]);

  if (!ref) return undefined;
  if (!needsLookup) return ref;
  return resolved?.ref === ref ? (resolved.url ?? undefined) : undefined;
}

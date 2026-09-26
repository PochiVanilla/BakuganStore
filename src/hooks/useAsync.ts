import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '@/services/api/client';
import { useLatestRef } from './useLatestRef';

/** Dependency chỉ nhận giá trị nguyên thuỷ để so sánh được bằng khoá chuỗi. */
export type AsyncDep = string | number | boolean | null | undefined;

export interface AsyncState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

interface InternalState<T> {
  key: string;
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
}

/**
 * Bọc một lời gọi service bất đồng bộ: quản lý loading / error / huỷ request cũ.
 * Khi chuyển sang React Query ở giai đoạn sau, chỉ cần thay hook này.
 */
export function useAsync<T>(
  factory: () => Promise<T>,
  deps: readonly AsyncDep[],
  options: {
    enabled?: boolean;
    /** Giữ dữ liệu cũ trong lúc tải lại (tránh nháy skeleton khi làm mới ngầm) */
    keepPreviousData?: boolean;
  } = {},
): AsyncState<T> {
  const { enabled = true, keepPreviousData = false } = options;
  const [nonce, setNonce] = useState(0);
  const depsKey = `${nonce}|${enabled}|${deps.map((dep) => String(dep)).join('\u0001')}`;

  const [state, setState] = useState<InternalState<T>>(() => ({
    key: depsKey,
    data: undefined,
    error: null,
    isLoading: enabled,
  }));

  // Deps đổi -> reset về trạng thái loading ngay khi render, thay vì setState
  // trong effect (tránh cascading render).
  if (state.key !== depsKey) {
    setState({
      key: depsKey,
      data: keepPreviousData ? state.data : undefined,
      error: null,
      isLoading: enabled,
    });
  }

  const factoryRef = useLatestRef(factory);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      try {
        const result = await factoryRef.current();
        if (!cancelled) {
          setState({ key: depsKey, data: result, error: null, isLoading: false });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setState({
            key: depsKey,
            data: undefined,
            error: getApiErrorMessage(error),
            isLoading: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [depsKey, enabled, factoryRef]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // Trong lần render có deps mới, `state` cũ vẫn đang nằm trong biến —
  // đọc theo khoá hiện tại để không trả dữ liệu của request trước.
  const isCurrent = state.key === depsKey;

  return {
    data: isCurrent || keepPreviousData ? state.data : undefined,
    isLoading: isCurrent ? state.isLoading : enabled,
    error: isCurrent ? state.error : null,
    reload,
  };
}

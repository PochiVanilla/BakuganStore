import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDbRevision, subscribeDb } from '@/mocks/db';
import { USE_MOCK } from '@/services/api/client';

/**
 * Số tăng lên mỗi khi dữ liệu phía server có thể đã đổi. Đưa vào deps của
 * `useAsync` để màn hình tự làm mới.
 *
 * - Chế độ mock: tăng ngay khi kho dữ liệu đổi, kể cả do tab khác ghi.
 * - Chế độ HTTP: chưa có WebSocket cho admin nên hỏi lại định kỳ.
 */
export function useLiveRevision(pollMs = 8_000): number {
  const mockRevision = useSyncExternalStore(subscribeDb, getDbRevision, getDbRevision);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (USE_MOCK) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs]);

  return USE_MOCK ? mockRevision : tick;
}

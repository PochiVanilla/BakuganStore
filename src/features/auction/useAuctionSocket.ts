import { useEffect, useState } from 'react';
import { USE_MOCK } from '@/services/api/client';
import { useLatestRef } from '@/hooks/useLatestRef';

export type AuctionSocketStatus = 'connecting' | 'open' | 'closed' | 'error' | 'mock';

export type AuctionSocketEvent =
  | {
      type: 'bid-placed';
      auctionId: string;
      amount: number;
      bidderId: string;
      bidderMaskedName: string;
      at: string;
    }
  | { type: 'auction-ended'; auctionId: string; at: string }
  | { type: 'watcher-count'; auctionId: string; count: number; at: string };

export interface UseAuctionSocketOptions {
  auctionId: string;
  /** Chỉ kết nối khi phiên đang diễn ra. */
  enabled?: boolean;
  /** Giá hiện tại, dùng để mock nhịp tăng giá cho hợp lý. */
  currentPrice?: number;
  bidStep?: number;
  onEvent?: (event: AuctionSocketEvent) => void;
}

export interface AuctionSocketResult {
  status: AuctionSocketStatus;
  lastEvent: AuctionSocketEvent | null;
}

const WS_URL = import.meta.env.VITE_WS_URL ?? '';

const MOCK_BIDDERS = ['Ngu** V** Hùng', 'Tr** G** Bảo', 'Lê H** Phúc', 'Ph** T** Hà', 'Đỗ Q** Huy'];

/**
 * Kênh realtime cho phiên đấu giá.
 *
 * - Hiện tại (USE_MOCK): giả lập người khác đặt giá theo chu kỳ ngẫu nhiên.
 * - Khi backend sẵn sàng: đặt VITE_USE_MOCK=false + VITE_WS_URL, hook tự mở
 *   WebSocket thật tới `${VITE_WS_URL}/auctions/:id` và phát cùng kiểu sự kiện.
 *   Component dùng hook không phải sửa một dòng nào.
 */
export function useAuctionSocket({
  auctionId,
  enabled = true,
  currentPrice = 0,
  bidStep = 50_000,
  onEvent,
}: UseAuctionSocketOptions): AuctionSocketResult {
  const isMockMode = USE_MOCK || !WS_URL;
  /** Chỉ chứa trạng thái do chính WebSocket báo về; null = chưa có tin gì. */
  const [wsStatus, setWsStatus] = useState<AuctionSocketStatus | null>(null);
  const [lastEvent, setLastEvent] = useState<AuctionSocketEvent | null>(null);

  // Đổi phiên hoặc bật/tắt kết nối thì quên trạng thái cũ — xử lý khi render
  // thay vì setState trong effect.
  const connectionKey = `${auctionId}|${String(enabled)}`;
  const [trackedKey, setTrackedKey] = useState(connectionKey);
  if (trackedKey !== connectionKey) {
    setTrackedKey(connectionKey);
    setWsStatus(null);
  }

  const onEventRef = useLatestRef(onEvent);
  const priceRef = useLatestRef(currentPrice);

  useEffect(() => {
    if (!enabled) return;

    const emit = (event: AuctionSocketEvent): void => {
      setLastEvent(event);
      onEventRef.current?.(event);
    };

    /* ---------- Chế độ mock ---------- */
    if (isMockMode) {
      let timeoutId = 0;
      let simulatedPrice = priceRef.current;

      const scheduleNext = (): void => {
        const delay = 16_000 + Math.random() * 14_000;
        timeoutId = window.setTimeout(() => {
          const bidderIndex = Math.floor(Math.random() * MOCK_BIDDERS.length);
          const increment = bidStep * (Math.random() > 0.7 ? 2 : 1);
          simulatedPrice = Math.max(simulatedPrice, priceRef.current) + increment;
          emit({
            type: 'bid-placed',
            auctionId,
            amount: simulatedPrice,
            bidderId: `usr-bot-${bidderIndex}`,
            bidderMaskedName: MOCK_BIDDERS[bidderIndex]!,
            at: new Date().toISOString(),
          });
          scheduleNext();
        }, delay);
      };

      scheduleNext();
      return () => window.clearTimeout(timeoutId);
    }

    /* ---------- Chế độ WebSocket thật ---------- */
    const socket = new WebSocket(`${WS_URL}/auctions/${auctionId}`);

    socket.onopen = () => setWsStatus('open');
    socket.onclose = () => setWsStatus('closed');
    socket.onerror = () => setWsStatus('error');
    socket.onmessage = (message: MessageEvent<string>) => {
      try {
        emit(JSON.parse(message.data) as AuctionSocketEvent);
      } catch {
        // Bỏ qua gói tin không đúng định dạng.
      }
    };

    return () => socket.close();
  }, [auctionId, enabled, bidStep, isMockMode, onEventRef, priceRef]);

  // Trạng thái suy ra hoàn toàn khi render, không cần setState trong effect.
  const status: AuctionSocketStatus = !enabled
    ? 'closed'
    : isMockMode
      ? 'mock'
      : (wsStatus ?? 'connecting');

  return { status, lastEvent };
}

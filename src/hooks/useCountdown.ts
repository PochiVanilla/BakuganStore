import { useMemo, useSyncExternalStore } from 'react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isFinished: boolean;
}

function computeParts(target: number, now: number): CountdownParts {
  const totalMs = Math.max(0, target - now);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    isFinished: totalMs <= 0,
  };
}

/* ------------------------------------------------------------------
   Một bộ đếm giây dùng chung cho toàn trang: dù có 10 đồng hồ đếm
   ngược thì vẫn chỉ tồn tại một setInterval duy nhất.
   ------------------------------------------------------------------ */
const listeners = new Set<() => void>();
let currentSecond = Math.floor(Date.now() / 1000);
let intervalId = 0;

function subscribe(onStoreChange: () => void): () => void {
  // Làm mới ngay khi có người đăng ký để tránh đọc phải mốc cũ.
  currentSecond = Math.floor(Date.now() / 1000);
  listeners.add(onStoreChange);

  if (intervalId === 0) {
    intervalId = window.setInterval(() => {
      const second = Math.floor(Date.now() / 1000);
      if (second === currentSecond) return;
      currentSecond = second;
      listeners.forEach((listener) => listener());
    }, 250);
  }

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      window.clearInterval(intervalId);
      intervalId = 0;
    }
  };
}

function getSnapshot(): number {
  return currentSecond;
}

/** Đồng hồ đếm ngược tới mốc ISO, cập nhật mỗi giây. */
export function useCountdown(targetIso: string): CountdownParts {
  const nowSecond = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);

  return useMemo(() => computeParts(target, nowSecond * 1000), [target, nowSecond]);
}

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Nhãn trục tiền gọn: 0 · 500k · 1,5tr · 12tr */
export function formatAxisMoney(value: number): string {
  if (value === 0) return '0';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/** "2026-09-26" -> { label: "26/9", fullLabel: "T7, 26/09/2026" } */
export function formatDayLabel(date: string): { label: string; fullLabel: string } {
  const value = new Date(`${date}T12:00:00+07:00`);
  const [, month, day] = date.split('-');
  return {
    label: `${Number(day)}/${Number(month)}`,
    fullLabel: value.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: VN_TIME_ZONE,
    }),
  };
}

/** "2026-09" -> "Th9/2026" */
export function formatMonthLabel(month: string): string {
  const [year, value] = month.split('-');
  return `Th${Number(value)}/${year}`;
}

/** Tỉ lệ 0.1234 -> "12,3%" */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

/** "Nguyễn Minh Khôi" -> "NK" (chữ cái đầu và cuối, dùng cho avatar) */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Mốc thời gian nhanh cho bộ lọc báo cáo */
export const RANGE_PRESETS = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]['value'];

/** Có nằm trong `days` ngày gần nhất không. */
export function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

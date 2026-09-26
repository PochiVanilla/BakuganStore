/** 1250000 -> "1.250.000₫" */
export function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}₫`;
}

/** 1250000 -> "1,25 triệu" (dùng cho badge/biểu đồ chật chỗ) */
export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace('.', ',')} triệu`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return formatCurrency(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

/** "2026-09-01T10:00:00Z" -> "01/09/2026" */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/** "2026-09-01T10:00:00Z" -> "01/09/2026 17:00" */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "2026-09-01T10:00:00Z" -> "17:00" */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/** "3 phút trước", "2 ngày trước" */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

  if (abs < 60) return rtf.format(Math.round(diffSeconds), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(diffSeconds / 86400), 'day');
  if (abs < 31536000) return rtf.format(Math.round(diffSeconds / 2592000), 'month');
  return rtf.format(Math.round(diffSeconds / 31536000), 'year');
}

/** Phần trăm giảm giá, làm tròn xuống. */
export function calcDiscountPercent(price: number, originalPrice?: number): number {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.floor(((originalPrice - price) / originalPrice) * 100);
}

/** "Nguyễn Văn An" -> "Nguy** V** An" (ẩn danh người đặt giá) */
export function maskName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((part, index, arr) => {
      if (index === arr.length - 1) return part;
      if (part.length <= 2) return `${part[0]}*`;
      return `${part.slice(0, 2)}${'*'.repeat(Math.max(2, part.length - 2))}`;
    })
    .join(' ');
}

/** "0912345678" -> "0912 *** 678" */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 4)} *** ${phone.slice(-3)}`;
}

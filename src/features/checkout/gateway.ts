import type { NavigateFunction } from 'react-router-dom';

/**
 * Sang trang nhập thẻ của cổng thanh toán. Bản chạy thử là trang nội bộ (cổng giả lập);
 * khi có backend, `url` là trang của cổng thanh toán thật nên phải rời hẳn web.
 */
export function goToGateway(url: string, navigate: NavigateFunction): void {
  if (url.startsWith('/')) navigate(url);
  else window.location.assign(url);
}

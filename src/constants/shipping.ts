import type { InternationalShippingSettings, ShippingRegion } from '@/types';

/* ============================================================
   Giao hàng trong nước / quốc tế và thanh toán thẻ.
   Phí trong nước nằm ở constants/routes.ts (SHIPPING_FEE…);
   phí quốc tế và tỉ giá do admin đặt trong trang Cài đặt.
   ============================================================ */

/** Giữ hàng bao nhiêu phút chờ khách trả bằng thẻ — quá hạn đơn tự huỷ, hàng mở bán lại */
export const CARD_HOLD_MINUTES = 15;

export const DELIVERY_ESTIMATE: Record<ShippingRegion, string> = {
  domestic: '1 – 5 ngày làm việc',
  international: '7 – 15 ngày làm việc',
};

/** Mặc định khi admin chưa chỉnh (phí cho một gói nhỏ dưới 1 kg) */
export const DEFAULT_INTERNATIONAL_SHIPPING: InternationalShippingSettings = {
  enabled: true,
  feeAsia: 350_000,
  feeWorld: 650_000,
  usdRate: 26_000,
};

export type ShippingZone = 'asia' | 'world';

export const ZONE_LABELS: Record<ShippingZone, string> = {
  asia: 'Đông Á & Đông Nam Á',
  world: 'Các nước khác',
};

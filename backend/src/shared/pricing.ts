// Tính tiền: đúng hàm web đang dùng, nên web và server không bao giờ tính lệch nhau.
export {
  calculateTotals,
  couponAppliesTo,
  DEFAULT_CHECKOUT_CONFIG,
  DOMESTIC,
  shippingFeeFor,
  type CartTotals,
  type ShippingDestination,
} from '../../../src/utils/pricing';

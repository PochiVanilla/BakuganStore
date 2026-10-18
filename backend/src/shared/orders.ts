// Luật đơn hàng dùng chung với web: bước chuyển trạng thái, nhãn, giữ hàng chờ trả thẻ,
// kiểm tra số điện thoại / địa chỉ quốc tế, thẻ thử của cổng giả lập, số con để lên Lv2.
export {
  ACTIVE_ORDER_STATUSES,
  CANCEL_REASON_LABELS,
  CARD_BRAND_LABELS,
  describeCard,
  ORDER_TRANSITIONS,
  PAYMENT_METHOD_LABELS,
  VOID_ORDER_STATUSES,
} from '../../../src/constants/orders';
export { CARD_HOLD_MINUTES } from '../../../src/constants/shipping';
export { PURCHASES_FOR_LV2 } from '../../../src/constants/catalog';
export {
  cleanIntlAddress,
  formatIntlAddress,
  validateIntlAddress,
} from '../../../src/utils/intlAddress';
export { compactPhone, isValidPhone, isVietnamPhone } from '../../../src/utils/phone';
export { cardDigits, expiryValid, luhnValid } from '../../../src/utils/card';
export { formatCurrency } from '../../../src/utils/format';
export {
  MOCK_FAILURE_MESSAGES,
  MOCK_OTP,
  MOCK_OTP_FAILED,
  MOCK_TEST_CARDS,
} from '../../../src/constants/testCards';

/** Bỏ khoảng trắng, dấu chấm, gạch nối, ngoặc mà khách hay gõ kèm số điện thoại. */
export function compactPhone(value: string): string {
  return value.replace(/[\s.()-]/g, '');
}

/** Số di động Việt Nam: 0912345678 hoặc +84912345678. */
export const VN_PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

/** Số nước ngoài theo chuẩn quốc tế: dấu + và mã nước, 8–15 chữ số (VD +1 415 555 0123). */
export const INTL_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function isVietnamPhone(value: string): boolean {
  return VN_PHONE_REGEX.test(compactPhone(value));
}

/** Số có mã nước khác Việt Nam (khách ở nước ngoài). */
export function isForeignPhone(value: string): boolean {
  const phone = compactPhone(value);
  return !phone.startsWith('+84') && INTL_PHONE_REGEX.test(phone);
}

/** Số Việt Nam, hoặc số nước ngoài có mã nước. */
export function isValidPhone(value: string): boolean {
  return isVietnamPhone(value) || isForeignPhone(value);
}

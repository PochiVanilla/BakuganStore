import type { InternationalAddress } from '@/types';
import { countryName, isShippableCountry, needsPostalCode } from '@/constants/countries';

/* Địa chỉ gửi ra nước ngoài — dùng chung cho form thanh toán và phía "server" khi đặt đơn. */

export type IntlAddressErrors = Partial<Record<keyof InternationalAddress, string>>;

const POSTAL_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/;

export const EMPTY_INTL_ADDRESS: InternationalAddress = {
  countryCode: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
};

export function cleanIntlAddress(address: InternationalAddress): InternationalAddress {
  const optional = (value: string | undefined): string | undefined => value?.trim() || undefined;
  return {
    countryCode: address.countryCode.trim().toUpperCase(),
    line1: address.line1.trim(),
    line2: optional(address.line2),
    city: address.city.trim(),
    region: optional(address.region),
    postalCode: optional(address.postalCode)?.toUpperCase(),
  };
}

export function validateIntlAddress(address: InternationalAddress): IntlAddressErrors {
  const value = cleanIntlAddress(address);
  const errors: IntlAddressErrors = {};
  if (!isShippableCountry(value.countryCode)) errors.countryCode = 'Chọn nước nhận hàng.';
  if (value.line1.length < 3) errors.line1 = 'Nhập số nhà, tên đường.';
  else if (value.line1.length > 100) errors.line1 = 'Tối đa 100 ký tự.';
  if ((value.line2?.length ?? 0) > 100) errors.line2 = 'Tối đa 100 ký tự.';
  if (value.city.length < 2) errors.city = 'Nhập thành phố.';
  else if (value.city.length > 60) errors.city = 'Tối đa 60 ký tự.';
  if ((value.region?.length ?? 0) > 60) errors.region = 'Tối đa 60 ký tự.';
  if (value.postalCode) {
    if (!POSTAL_CODE_REGEX.test(value.postalCode)) errors.postalCode = 'Mã bưu chính không hợp lệ.';
  } else if (value.countryCode && needsPostalCode(value.countryCode)) {
    errors.postalCode = 'Nhập mã bưu chính (ZIP / postcode).';
  }
  return errors;
}

/** Một dòng để in nhãn gửi hàng, VD "350 5th Ave, Apt 12, New York, NY 10118, United States". */
export function formatIntlAddress(address: InternationalAddress): string {
  const value = cleanIntlAddress(address);
  const regionAndCode = [value.region, value.postalCode].filter(Boolean).join(' ');
  return [
    value.line1,
    value.line2,
    [value.city, regionAndCode].filter(Boolean).join(', '),
    countryName(value.countryCode, 'en'),
  ]
    .filter(Boolean)
    .join(', ');
}

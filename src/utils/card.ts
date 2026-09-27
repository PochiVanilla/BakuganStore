import type { CardBrand } from '@/types';

/* Tiện ích thẻ cho cổng thanh toán giả lập. Web thật không xử lý số thẻ — việc đó ở cổng thanh toán. */

export function cardDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Đoán hãng thẻ theo đầu số (BIN). */
export function detectCardBrand(value: string): CardBrand | undefined {
  const digits = cardDigits(value);
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard';
  if (/^35(2[89]|[3-8])/.test(digits)) return 'jcb';
  if (/^3[47]/.test(digits)) return 'amex';
  return undefined;
}

/** Kiểm tra số thẻ theo thuật toán Luhn (số cuối là số kiểm tra). */
export function luhnValid(value: string): boolean {
  const digits = cardDigits(value);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** "4242424242424242" -> "4242 4242 4242 4242" (Amex: 4-6-5). */
export function formatCardNumber(value: string): string {
  const digits = cardDigits(value).slice(0, 19);
  if (detectCardBrand(digits) === 'amex') {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]
      .filter(Boolean)
      .join(' ');
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "0829" / "08/29" -> "08/29" khi gõ ô hạn thẻ. */
export function formatExpiry(value: string): string {
  const digits = cardDigits(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Hạn thẻ MM/YY còn dùng được tới cuối tháng đó. */
export function expiryValid(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 1).getTime() > now.getTime();
}

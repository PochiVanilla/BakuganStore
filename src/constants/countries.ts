import type { ShippingZone } from './shipping';

/* Danh sách nước gửi hàng được, vùng tính phí và tên nước — chỉ tải ở trang thanh toán / admin. */

/**
 * Mã nước ISO 3166-1 gửi hàng được: mọi nước trừ Việt Nam (đơn trong nước) và các vùng
 * không có dịch vụ bưu chính (Nam Cực, các đảo không người ở…).
 */
const SHIPPABLE_CODES =
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR ' +
  'BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ ' +
  'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW ' +
  'GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ ' +
  'LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV ' +
  'MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW ' +
  'PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD ' +
  'TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VU WF WS YE YT ZA ZM ZW';

export const SHIPPABLE_COUNTRIES: readonly string[] = SHIPPABLE_CODES.split(' ');
const SHIPPABLE_SET = new Set(SHIPPABLE_COUNTRIES);

/** Khách nước ngoài của shop hay ở những nước này — đưa lên đầu ô chọn */
export const POPULAR_COUNTRIES: readonly string[] = [
  'US',
  'AU',
  'CA',
  'JP',
  'KR',
  'TW',
  'SG',
  'DE',
  'FR',
  'GB',
];

/** Đông Á & Đông Nam Á — gần, phí gửi thấp hơn */
const ASIA_ZONE = new Set('BN CN HK ID JP KH KR LA MM MN MO MY PH SG TH TL TW'.split(' '));

/** Những nơi không dùng (hoặc hầu như không dùng) mã bưu chính */
const NO_POSTAL_CODE = new Set(
  (
    'AE AG AO AW BF BI BJ BO BS BW BZ CD CF CG CI CK CM DJ DM ER FJ GA GD GH GM GQ GY HK IE ' +
    'JM KE KI KM KN KP LY ML MO MR MW NG NR NU PA QA RW SB SC SL SR ST SY TD TG TK TL TO TV ' +
    'TZ UG VU YE ZW'
  ).split(' '),
);

export function isShippableCountry(code: string): boolean {
  return SHIPPABLE_SET.has(code);
}

export function zoneOf(countryCode: string): ShippingZone {
  return ASIA_ZONE.has(countryCode) ? 'asia' : 'world';
}

export function needsPostalCode(countryCode: string): boolean {
  return !NO_POSTAL_CODE.has(countryCode);
}

let viNames: Intl.DisplayNames | undefined;
let enNames: Intl.DisplayNames | undefined;

/** Tên nước theo mã ISO, VD "US" -> "Hoa Kỳ" (vi) / "United States" (en). */
export function countryName(code: string, locale: 'vi' | 'en' = 'vi'): string {
  try {
    if (locale === 'vi') {
      viNames ??= new Intl.DisplayNames(['vi'], { type: 'region' });
      return viNames.of(code) ?? code;
    }
    enNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return enNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  code: string;
  label: string;
}

/**
 * Nhãn trong ô chọn nước: tên tiếng Anh trước (khách nước ngoài gõ chữ đầu để tìm),
 * kèm tên tiếng Việt, VD "Japan — Nhật Bản".
 */
function optionOf(code: string): CountryOption {
  const en = countryName(code, 'en');
  const vi = countryName(code, 'vi');
  return { code, label: en === vi ? en : `${en} — ${vi}` };
}

export function countryOptions(): { popular: CountryOption[]; all: CountryOption[] } {
  return {
    popular: POPULAR_COUNTRIES.map(optionOf),
    all: SHIPPABLE_COUNTRIES.map(optionOf).sort((a, b) => a.label.localeCompare(b.label, 'en')),
  };
}

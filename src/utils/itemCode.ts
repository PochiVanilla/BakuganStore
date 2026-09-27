/** Mã Bakugan dạng BK-0231: phần thứ hai sau tên do chủ shop đặt. */
export const ITEM_CODE_PATTERN = /^BK-\d{4,}$/;

export function formatItemCode(sequence: number): string {
  return `BK-${String(sequence).padStart(4, '0')}`;
}

/** Chuẩn hoá mã admin gõ tay: " bk 231 " -> "BK-0231". Không hợp lệ thì trả về undefined. */
export function normalizeItemCode(input: string): string | undefined {
  const match = input
    .trim()
    .toUpperCase()
    .match(/^BK[\s-]?(\d{1,6})$/);
  if (!match) return undefined;
  return formatItemCode(Number(match[1]));
}

/**
 * Chuyển tiếng Việt có dấu thành URL không dấu.
 * "Bakugan Dragonoid Hệ Pyrus" -> "bakugan-dragonoid-he-pyrus"
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Bỏ dấu để so khớp tìm kiếm ("dragonoid" khớp cả "Dragonoid" lẫn "Drágonoid"). */
export function normalizeSearch(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
}

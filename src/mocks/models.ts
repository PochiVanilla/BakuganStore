import type { BakuganAttribute, BakuganSeries } from '@/types';

/**
 * Những mẫu Bakugan shop hay nhập về — chỉ dùng để sinh dữ liệu mẫu cho feed.
 * Hàng thật do admin tự đặt tên, mã và giá cho từng con khi đăng feed.
 */
export interface BakuganModel {
  name: string;
  attribute: BakuganAttribute;
  series: BakuganSeries;
  /** Giá tham khảo cho một con like new */
  basePrice: number;
  rare?: boolean;
}

export const BAKUGAN_MODELS: readonly BakuganModel[] = [
  {
    name: 'Dragonoid Chiến Binh Lửa',
    attribute: 'pyrus',
    series: 'battle-brawlers',
    basePrice: 1_150_000,
  },
  {
    name: 'Tigrerra Ánh Sáng Bạch Kim',
    attribute: 'haos',
    series: 'battle-brawlers',
    basePrice: 820_000,
  },
  {
    name: 'Preyas Sóng Ngầm',
    attribute: 'aquos',
    series: 'battle-brawlers',
    basePrice: 420_000,
  },
  {
    name: 'Gorem Hộ Vệ Thạch Sơn',
    attribute: 'subterra',
    series: 'battle-brawlers',
    basePrice: 980_000,
  },
  {
    name: 'Hydranoid Bóng Đêm Tam Đầu',
    attribute: 'darkus',
    series: 'battle-brawlers',
    basePrice: 2_150_000,
    rare: true,
  },
  {
    name: 'Skyress Phượng Hoàng Gió',
    attribute: 'ventus',
    series: 'battle-brawlers',
    basePrice: 720_000,
  },
  {
    name: 'Ingram Song Kiếm Lục Phong',
    attribute: 'ventus',
    series: 'new-vestroia',
    basePrice: 1_280_000,
  },
  {
    name: 'Elfin Tia Nước Bạc',
    attribute: 'aquos',
    series: 'new-vestroia',
    basePrice: 380_000,
  },
  {
    name: 'Percival Hắc Kỵ Sĩ',
    attribute: 'darkus',
    series: 'new-vestroia',
    basePrice: 1_450_000,
  },
  {
    name: 'Wilda Nắm Đấm Đất',
    attribute: 'subterra',
    series: 'new-vestroia',
    basePrice: 590_000,
  },
  {
    name: 'Nemus Ánh Quang Trượng',
    attribute: 'haos',
    series: 'new-vestroia',
    basePrice: 880_000,
  },
  {
    name: 'Neo Dragonoid Bão Lửa',
    attribute: 'pyrus',
    series: 'new-vestroia',
    basePrice: 1_750_000,
  },
  {
    name: 'Linehalt Xích Bóng Tối',
    attribute: 'darkus',
    series: 'gundalian-invaders',
    basePrice: 1_950_000,
    rare: true,
  },
  {
    name: 'Aranaut Găng Tay Thép',
    attribute: 'haos',
    series: 'gundalian-invaders',
    basePrice: 1_150_000,
  },
  {
    name: 'Akwimos Xoáy Nước Kép',
    attribute: 'aquos',
    series: 'gundalian-invaders',
    basePrice: 490_000,
  },
  {
    name: 'Coredem Đá Tảng Cổ',
    attribute: 'subterra',
    series: 'gundalian-invaders',
    basePrice: 1_520_000,
  },
  {
    name: 'Titanium Dragonoid Vàng Kim',
    attribute: 'pyrus',
    series: 'mechtanium-surge',
    basePrice: 2_890_000,
    rare: true,
  },
  {
    name: 'Wolfurio Sói Bạc Chiến Trận',
    attribute: 'haos',
    series: 'mechtanium-surge',
    basePrice: 1_890_000,
    rare: true,
  },
  {
    name: 'Reptak Giáp Lục Cổ Đại',
    attribute: 'subterra',
    series: 'mechtanium-surge',
    basePrice: 1_190_000,
  },
  {
    name: 'Infinity Helios Hoả Ngục',
    attribute: 'pyrus',
    series: 'mechtanium-surge',
    basePrice: 2_380_000,
    rare: true,
  },
  {
    name: 'Pegatrix Cánh Ngọc',
    attribute: 'ventus',
    series: 'battle-planet',
    basePrice: 320_000,
  },
  {
    name: 'Howlkor Sói Tối Thượng',
    attribute: 'darkus',
    series: 'battle-planet',
    basePrice: 360_000,
  },
  {
    name: 'Trhyno Sừng Thép',
    attribute: 'subterra',
    series: 'battle-planet',
    basePrice: 290_000,
  },
  {
    name: 'Nillious Thuỷ Triều Xanh',
    attribute: 'aquos',
    series: 'battle-planet',
    basePrice: 330_000,
  },
  {
    name: 'Pyravian Ưng Lửa',
    attribute: 'pyrus',
    series: 'battle-planet',
    basePrice: 350_000,
  },
  {
    name: 'Hydorous Long Vương Đại Dương',
    attribute: 'aquos',
    series: 'geogan-rising',
    basePrice: 1_650_000,
    rare: true,
  },
  {
    name: 'Sharpedoid Lưỡi Kiếm Biển',
    attribute: 'aquos',
    series: 'geogan-rising',
    basePrice: 1_250_000,
  },
  {
    name: 'Mantonoid Song Đao Gió',
    attribute: 'ventus',
    series: 'geogan-rising',
    basePrice: 1_390_000,
    rare: true,
  },
  {
    name: 'Barbetra Pháo Đài Đất',
    attribute: 'subterra',
    series: 'geogan-rising',
    basePrice: 1_780_000,
    rare: true,
  },
  {
    name: 'Lupitheon Ánh Nguyệt',
    attribute: 'haos',
    series: 'geogan-rising',
    basePrice: 1_520_000,
    rare: true,
  },
  {
    name: 'Fenneca Hồ Ly Lửa',
    attribute: 'pyrus',
    series: 'geogan-rising',
    basePrice: 720_000,
  },
  {
    name: 'Gillator Hàm Cá Sấu',
    attribute: 'darkus',
    series: 'geogan-rising',
    basePrice: 1_190_000,
  },
];

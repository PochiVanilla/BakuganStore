import type {
  BakuganAttribute,
  BakuganSeries,
  OrderStatus,
  ProductCondition,
  ProductSort,
} from '@/types';

export interface AttributeMeta {
  value: BakuganAttribute;
  label: string;
  description: string;
  /** Màu hex dùng cho border/glow động (Tailwind không sinh class từ biến runtime) */
  color: string;
  element: string;
}

export const ATTRIBUTE_META: Record<BakuganAttribute, AttributeMeta> = {
  pyrus: {
    value: 'pyrus',
    label: 'Pyrus',
    description: 'Hệ Lửa — sức tấn công bùng nổ',
    color: '#FF4D3D',
    element: 'Lửa',
  },
  aquos: {
    value: 'aquos',
    label: 'Aquos',
    description: 'Hệ Nước — linh hoạt, khó đoán',
    color: '#3FA9F5',
    element: 'Nước',
  },
  subterra: {
    value: 'subterra',
    label: 'Subterra',
    description: 'Hệ Đất — phòng thủ vững chắc',
    color: '#C8853A',
    element: 'Đất',
  },
  haos: {
    value: 'haos',
    label: 'Haos',
    description: 'Hệ Ánh sáng — cân bằng toàn diện',
    color: '#EDEDDC',
    element: 'Ánh sáng',
  },
  darkus: {
    value: 'darkus',
    label: 'Darkus',
    description: 'Hệ Bóng tối — phản đòn hiểm hóc',
    color: '#8B5CF6',
    element: 'Bóng tối',
  },
  ventus: {
    value: 'ventus',
    label: 'Ventus',
    description: 'Hệ Gió — tốc độ vượt trội',
    color: '#4ADE80',
    element: 'Gió',
  },
};

export interface SeriesMeta {
  value: BakuganSeries;
  label: string;
  years: string;
  description: string;
}

export const SERIES_META: Record<BakuganSeries, SeriesMeta> = {
  'battle-brawlers': {
    value: 'battle-brawlers',
    label: 'Battle Brawlers',
    years: '2007 – 2008',
    description: 'Thế hệ đầu tiên, món đồ quốc dân của mọi nhà sưu tầm.',
  },
  'new-vestroia': {
    value: 'new-vestroia',
    label: 'New Vestroia',
    years: '2009 – 2010',
    description: 'Kỷ nguyên Bakugan Trap với cơ cấu bung nở nâng cấp.',
  },
  'gundalian-invaders': {
    value: 'gundalian-invaders',
    label: 'Gundalian Invaders',
    years: '2010 – 2011',
    description: 'BakuNano và thiết kế giáp nặng, rất được săn đón.',
  },
  'mechtanium-surge': {
    value: 'mechtanium-surge',
    label: 'Mechtanium Surge',
    years: '2011 – 2012',
    description: 'Mechtogan khổng lồ, G-Power thuộc hàng cao nhất.',
  },
  'battle-planet': {
    value: 'battle-planet',
    label: 'Battle Planet',
    years: '2019 – 2020',
    description: 'Bản làm lại hiện đại, cơ cấu bung nở mượt và bền.',
  },
  'geogan-rising': {
    value: 'geogan-rising',
    label: 'Geogan Rising',
    years: '2021 – 2022',
    description: 'Geogan biến hình hai dạng, hiếm hàng tại Việt Nam.',
  },
};

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  'new-sealed': 'Mới nguyên seal',
  'like-new': 'Like new',
  used: 'Đã qua sử dụng',
};

export const CONDITION_DESCRIPTIONS: Record<ProductCondition, string> = {
  'new-sealed': 'Còn nguyên hộp/seal của nhà sản xuất, chưa bóc.',
  'like-new': 'Đã mở hộp nhưng gần như mới, không trầy xước đáng kể.',
  used: 'Đã chơi, có dấu vết sử dụng nhẹ, cơ cấu bung nở còn tốt.',
};

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Mới nhất',
  'price-asc': 'Giá tăng dần',
  'price-desc': 'Giá giảm dần',
  'best-selling': 'Bán chạy nhất',
  'g-power-desc': 'G-Power cao nhất',
};

export const AUCTION_STATUS_LABELS = {
  upcoming: 'Sắp diễn ra',
  live: 'Đang diễn ra',
  ended: 'Đã kết thúc',
} as const;

export const ORDER_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  returned: 'Hoàn trả',
} as const satisfies Record<OrderStatus, string>;

/** Khoảng giá gợi ý cho sidebar lọc. */
export const PRICE_RANGES = [
  { label: 'Dưới 300.000₫', min: 0, max: 300_000 },
  { label: '300.000₫ – 600.000₫', min: 300_000, max: 600_000 },
  { label: '600.000₫ – 1.000.000₫', min: 600_000, max: 1_000_000 },
  { label: '1.000.000₫ – 2.000.000₫', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2.000.000₫', min: 2_000_000, max: Number.MAX_SAFE_INTEGER },
] as const;

export const G_POWER_RANGES = [
  { label: 'Dưới 400 G', min: 0, max: 400 },
  { label: '400 – 700 G', min: 400, max: 700 },
  { label: '700 – 1000 G', min: 700, max: 1000 },
  { label: 'Trên 1000 G', min: 1000, max: Number.MAX_SAFE_INTEGER },
] as const;

export const PRODUCT_PAGE_SIZE = 9;

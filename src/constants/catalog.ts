import type {
  BakuganAttribute,
  BakuganSeries,
  FeedStatus,
  FeedStatusFilter,
  OrderStatus,
  ProductCondition,
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

export const FEED_STATUS_LABELS: Record<FeedStatus, string> = {
  upcoming: 'Sắp mở bán',
  selling: 'Đang bán',
  'sold-out': 'Đã bán hết',
};

export const FEED_FILTER_LABELS: Record<FeedStatusFilter, string> = {
  all: 'Tất cả',
  selling: 'Đang bán',
  upcoming: 'Sắp mở bán',
  'sold-out': 'Đã bán hết',
};

/** Trang chủ hiện tối đa ngần này feed mới nhất. */
export const HOME_FEED_LIMIT = 10;

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

/** Khoảng giá gợi ý cho bộ lọc Bakugan. */
export const PRICE_RANGES = [
  { label: 'Dưới 300.000₫', min: 0, max: 300_000 },
  { label: '300.000₫ – 600.000₫', min: 300_000, max: 600_000 },
  { label: '600.000₫ – 1.000.000₫', min: 600_000, max: 1_000_000 },
  { label: '1.000.000₫ – 2.000.000₫', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2.000.000₫', min: 2_000_000, max: Number.MAX_SAFE_INTEGER },
] as const;

/** Hạng thành viên */
export const MEMBER_LEVEL_LABELS = {
  1: 'Thành viên Lv1',
  2: 'Thành viên Lv2',
} as const;

/** Muốn đặt giá đấu giá thì phải từ hạng này trở lên. */
export const AUCTION_MIN_LEVEL = 2;
/** Nhận đủ ngần này con Bakugan (đơn hoàn tất) thì tự lên Lv2. */
export const PURCHASES_FOR_LV2 = 3;

export const LEVEL_SOURCE_LABELS = {
  purchases: 'Đã mua đủ 3 Bakugan',
  deposit: 'Đã nạp tiền thành viên',
  admin: 'Admin duyệt',
} as const;

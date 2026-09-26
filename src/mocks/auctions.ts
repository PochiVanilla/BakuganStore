import type {
  Auction,
  AuctionStatus,
  Bid,
  BakuganAttribute,
  BakuganSeries,
  ProductCondition,
} from '@/types';
import { ATTRIBUTE_META, SERIES_META, CONDITION_LABELS } from '@/constants/catalog';
import { productPlaceholder } from '@/utils/placeholder';
import { maskName } from '@/utils/format';
import { slugify } from '@/utils/slugify';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const now = Date.now();

const BIDDER_POOL = [
  'Nguyễn Minh Khôi',
  'Trần Gia Bảo',
  'Lê Hoàng Phúc',
  'Phạm Thu Hà',
  'Đỗ Quang Huy',
  'Vũ Nhật Nam',
  'Bùi Khánh Linh',
  'Hoàng Anh Tuấn',
  'Đặng Tiến Dũng',
  'Ngô Thanh Tùng',
];

/**
 * Người đặt giá trong dữ liệu mẫu, khớp id với danh sách khách hàng ở trang
 * quản trị. Người đầu tiên chính là tài khoản demo.
 */
export const AUCTION_BIDDERS: ReadonlyArray<{ id: string; fullName: string }> = BIDDER_POOL.map(
  (fullName, index) => ({
    id: index === 0 ? 'usr-001' : `usr-0${10 + index}`,
    fullName,
  }),
);

interface AuctionSeed {
  name: string;
  attribute: BakuganAttribute;
  series: BakuganSeries;
  gPower: number;
  condition: ProductCondition;
  startPrice: number;
  bidStep: number;
  buyNowPrice?: number;
  /** Âm = đã bắt đầu từ n giờ trước; dương = còn n giờ nữa mới mở */
  startsInHours: number;
  endsInHours: number;
  bidCount: number;
  watcherCount: number;
  /** Giấu giá hiện tại (đấu giá kín) hay không */
  sealed?: boolean;
  /** Số phút chống bắn tỉa; bỏ trống dùng mặc định 5 phút */
  antiSnipeMinutes?: number;
  /** Phiên đã được gia hạn mấy lần */
  extensionCount?: number;
  extras: string[];
  blurb: string;
}

const SEEDS: AuctionSeed[] = [
  {
    name: 'Titanium Dragonoid Bản Mạ Vàng Giới Hạn',
    attribute: 'pyrus',
    series: 'mechtanium-surge',
    gPower: 1_200,
    condition: 'new-sealed',
    startPrice: 2_500_000,
    bidStep: 100_000,
    buyNowPrice: 6_500_000,
    startsInHours: -20,
    endsInHours: 9,
    bidCount: 18,
    watcherCount: 214,
    extensionCount: 2,
    extras: ['Mechtogan', 'Thẻ bài kim loại', 'Hộp trưng bày nguyên seal'],
    blurb:
      'Bản mạ nhũ vàng số lượng giới hạn, chưa từng bóc seal. Đây là món có G-Power cao nhất từng lên sàn đấu giá của TD Bakugan.',
  },
  {
    name: 'Hydranoid Tam Đầu Nguyên Hộp Đời Đầu',
    attribute: 'darkus',
    series: 'battle-brawlers',
    gPower: 960,
    condition: 'new-sealed',
    startPrice: 1_800_000,
    bidStep: 50_000,
    startsInHours: -46,
    endsInHours: 31,
    bidCount: 12,
    watcherCount: 168,
    sealed: true,
    extras: ['Thẻ bài kim loại', 'Thẻ năng lực', 'Hộp gốc 2008'],
    blurb:
      'Hàng tồn kho cửa hàng từ đời Battle Brawlers, hộp giấy còn nguyên tem, góc hộp chỉ móp nhẹ do thời gian.',
  },
  {
    name: 'Linehalt Bóng Tối Kèm Trọn Bộ BakuNano',
    attribute: 'darkus',
    series: 'gundalian-invaders',
    gPower: 1_040,
    condition: 'like-new',
    startPrice: 1_500_000,
    bidStep: 50_000,
    buyNowPrice: 4_200_000,
    startsInHours: -6,
    endsInHours: 2,
    bidCount: 23,
    watcherCount: 296,
    antiSnipeMinutes: 10,
    extensionCount: 4,
    extras: ['Trọn bộ 3 BakuNano', 'Thẻ bài kim loại'],
    blurb:
      'Phiên đấu giá nóng nhất tuần: đi kèm trọn bộ ba BakuNano, rất khó gom đủ trên thị trường Việt Nam.',
  },
  {
    name: 'Lupitheon Ánh Nguyệt Bản Sưu Tầm',
    attribute: 'haos',
    series: 'geogan-rising',
    gPower: 950,
    condition: 'new-sealed',
    startPrice: 1_200_000,
    bidStep: 50_000,
    startsInHours: 14,
    endsInHours: 86,
    bidCount: 0,
    watcherCount: 87,
    sealed: true,
    extras: ['Geogan', 'Thẻ bài kim loại'],
    blurb:
      'Mở phiên vào tối mai. Đăng ký theo dõi để nhận thông báo ngay khi phiên bắt đầu nhận giá.',
  },
  {
    name: 'Combo 5 Bakugan Hệ Ventus Đủ Series',
    attribute: 'ventus',
    series: 'new-vestroia',
    gPower: 880,
    condition: 'like-new',
    startPrice: 2_000_000,
    bidStep: 100_000,
    startsInHours: 38,
    endsInHours: 134,
    bidCount: 0,
    watcherCount: 52,
    extras: ['5 Bakugan hệ Ventus', 'Thẻ bài kim loại', 'Túi đựng chuyên dụng'],
    blurb:
      'Lô combo gồm 5 Bakugan hệ Ventus trải đều các series, phù hợp cho ai muốn hoàn thiện bộ sưu tập một lần.',
  },
  {
    name: 'Infinity Helios Hoả Ngục Bản Hiếm',
    attribute: 'pyrus',
    series: 'mechtanium-surge',
    gPower: 1_130,
    condition: 'like-new',
    startPrice: 1_600_000,
    bidStep: 50_000,
    startsInHours: -168,
    endsInHours: -24,
    bidCount: 31,
    watcherCount: 341,
    extras: ['Mechtogan', 'Thẻ bài kim loại', 'Hộp trưng bày'],
    blurb:
      'Phiên đã kết thúc. Mức chốt cuối cùng cho thấy sức hút của dòng Mechtanium Surge vẫn rất mạnh.',
  },
  {
    name: 'Preyas Song Sinh Đổi Màu Bản Nhật',
    attribute: 'aquos',
    series: 'battle-brawlers',
    gPower: 610,
    condition: 'like-new',
    startPrice: 900_000,
    bidStep: 30_000,
    startsInHours: -240,
    endsInHours: -72,
    bidCount: 14,
    watcherCount: 188,
    extras: ['Thẻ bài kim loại', 'Hộp gốc'],
    blurb:
      'Phiên đã kết thúc. Bản Preyas đổi màu nội địa Nhật, cơ cấu xoay mặt còn nhạy, sơn gần như nguyên vẹn.',
  },
];

function resolveStatus(startAt: number, endAt: number): AuctionStatus {
  if (now < startAt) return 'upcoming';
  if (now > endAt) return 'ended';
  return 'live';
}

function buildBids(auctionId: string, seed: AuctionSeed, endAt: number): Bid[] {
  if (seed.bidCount === 0) return [];
  const bids: Bid[] = [];
  let amount = seed.startPrice;
  const lastBidAt = Math.min(now, endAt) - 4 * MINUTE;
  const spacing = (2 * HOUR) / Math.max(1, seed.bidCount);

  for (let i = 0; i < seed.bidCount; i += 1) {
    const bidderIndex = (i * 3 + seed.name.length) % BIDDER_POOL.length;
    const fullName = BIDDER_POOL[bidderIndex]!;
    amount += seed.bidStep * (1 + (i % 3 === 0 ? 1 : 0));
    bids.push({
      id: `bid-${auctionId}-${i + 1}`,
      auctionId,
      bidderId: AUCTION_BIDDERS[bidderIndex]!.id,
      bidderMaskedName: maskName(fullName),
      amount,
      createdAt: new Date(lastBidAt - (seed.bidCount - 1 - i) * spacing).toISOString(),
    });
  }
  // Mới nhất lên đầu
  return bids.reverse();
}

export const MOCK_AUCTIONS: Auction[] = SEEDS.map((seed, index) => {
  const id = `auc-${(index + 1).toString().padStart(3, '0')}`;
  const startAt = now + seed.startsInHours * HOUR;
  const endAt = now + seed.endsInHours * HOUR;
  const status = resolveStatus(startAt, endAt);
  const bids = buildBids(id, seed, endAt);
  const currentPrice = bids.length > 0 ? bids[0]!.amount : seed.startPrice;
  const attributeMeta = ATTRIBUTE_META[seed.attribute];
  const seriesMeta = SERIES_META[seed.series];

  return {
    id,
    slug: slugify(seed.name),
    title: seed.name,
    description: [
      seed.blurb,
      `Hệ ${attributeMeta.label} (${attributeMeta.element}) · Dòng ${seriesMeta.label} (${seriesMeta.years}) · G-Power ${seed.gPower}G · ${CONDITION_LABELS[seed.condition]}.`,
      'Người thắng phiên sẽ được TD Bakugan liên hệ trong vòng 24 giờ để xác nhận địa chỉ giao hàng. Sản phẩm được quay video khi đóng gói và gửi kèm ảnh thực tế trước khi chuyển đi.',
    ].join('\n\n'),
    images: [0, 1, 2].map((variant) => productPlaceholder(seed.name, seed.attribute, variant + 5)),
    startPrice: seed.startPrice,
    currentPrice,
    bidStep: seed.bidStep,
    buyNowPrice: seed.buyNowPrice,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    originalEndAt: new Date(
      endAt - (seed.extensionCount ?? 0) * (seed.antiSnipeMinutes ?? 5) * MINUTE,
    ).toISOString(),
    status,
    priceVisibility: seed.sealed ? 'sealed' : 'open',
    antiSnipeMinutes: seed.antiSnipeMinutes ?? 5,
    extensionCount: seed.extensionCount ?? 0,
    bidCount: bids.length,
    watcherCount: seed.watcherCount,
    attribute: seed.attribute,
    series: seed.series,
    gPower: seed.gPower,
    condition: seed.condition,
    accessories: seed.extras.map((name) => ({ name, included: true })),
    bids,
    winnerMaskedName: status === 'ended' && bids.length > 0 ? bids[0]!.bidderMaskedName : undefined,
  } satisfies Auction;
});

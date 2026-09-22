/* ============================================================
   Domain types — dùng chung cho frontend và backend TypeScript
   (backend Node.js sau này import lại được nguyên vẹn)
   ============================================================ */

/* ---------- Hệ (Attribute) ---------- */
export const BAKUGAN_ATTRIBUTES = [
  'pyrus',
  'aquos',
  'subterra',
  'haos',
  'darkus',
  'ventus',
] as const;
export type BakuganAttribute = (typeof BAKUGAN_ATTRIBUTES)[number];

/* ---------- Dòng sản phẩm (Series) ---------- */
export const BAKUGAN_SERIES = [
  'battle-brawlers',
  'new-vestroia',
  'gundalian-invaders',
  'mechtanium-surge',
  'battle-planet',
  'geogan-rising',
] as const;
export type BakuganSeries = (typeof BAKUGAN_SERIES)[number];

/* ---------- Tình trạng ---------- */
export const PRODUCT_CONDITIONS = ['new-sealed', 'like-new', 'used'] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

/* ---------- Nhãn trạng thái ---------- */
export type ProductBadge = 'NEW' | 'HOT' | 'SALE' | 'RARE' | 'OUT_OF_STOCK';

export interface ProductAccessory {
  name: string;
  included: boolean;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Review {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  verifiedPurchase: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  images: string[];
  price: number;
  /** Giá gốc, chỉ có khi sản phẩm đang giảm giá */
  originalPrice?: number;
  attribute: BakuganAttribute;
  series: BakuganSeries;
  gPower: number;
  condition: ProductCondition;
  stock: number;
  soldCount: number;
  rating: number;
  reviewCount: number;
  /** ISO date — dùng để tính nhãn "Hàng mới" (trong 30 ngày) */
  createdAt: string;
  accessories: ProductAccessory[];
  specs: ProductSpec[];
  tags: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isRare: boolean;
}

/* ---------- Đấu giá ---------- */
export type AuctionStatus = 'upcoming' | 'live' | 'ended';

export interface Bid {
  id: string;
  auctionId: string;
  /** Tên đã ẩn một phần, ví dụ "Ngu**n V**n A" */
  bidderMaskedName: string;
  bidderId: string;
  amount: number;
  createdAt: string;
  /** Lượt đặt này có kích hoạt gia hạn chống bắn tỉa hay không */
  triggeredExtension?: boolean;
}

/**
 * Cách công khai giá của một phiên.
 * - `open`  : đấu giá mở, ai cũng thấy giá hiện tại và toàn bộ lịch sử.
 * - `sealed`: đấu giá kín, giấu giá hiện tại và số tiền trong lịch sử.
 *             Người tham gia chỉ biết mình đang dẫn đầu hay đã bị vượt,
 *             nên không thể canh đúng một bước giá để vượt phút chót.
 */
export type AuctionPriceVisibility = 'open' | 'sealed';

export interface Auction {
  id: string;
  slug: string;
  title: string;
  description: string;
  images: string[];
  startPrice: number;
  currentPrice: number;
  /** Bước giá tối thiểu mỗi lần đặt */
  bidStep: number;
  /** Mua ngay, bỏ qua đấu giá (tuỳ chọn) */
  buyNowPrice?: number;
  startAt: string;
  /** Thời điểm kết thúc hiện tại — có thể bị đẩy ra sau bởi luật chống bắn tỉa */
  endAt: string;
  /** Thời điểm kết thúc ban đầu, giữ lại để hiển thị "đã gia hạn" */
  originalEndAt: string;
  status: AuctionStatus;
  /** Giấu giá hay không */
  priceVisibility: AuctionPriceVisibility;
  /**
   * Chống bắn tỉa: lượt đặt trong ngần này phút cuối sẽ đẩy giờ kết thúc
   * ra thêm đúng ngần đó phút. 0 nghĩa là tắt luật này.
   */
  antiSnipeMinutes: number;
  /** Số lần phiên đã được gia hạn */
  extensionCount: number;
  bidCount: number;
  watcherCount: number;
  attribute: BakuganAttribute;
  series: BakuganSeries;
  gPower: number;
  condition: ProductCondition;
  accessories: ProductAccessory[];
  bids: Bid[];
  winnerMaskedName?: string;
}

/* ---------- Người dùng ---------- */
export interface Address {
  id: string;
  label: string;
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  createdAt: string;
  addresses: Address[];
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/* ---------- Giỏ hàng & Đơn hàng ---------- */
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  attribute: BakuganAttribute;
  condition: ProductCondition;
  quantity: number;
  /** Tồn kho tại thời điểm thêm vào giỏ, dùng để chặn tăng quá số lượng */
  maxQuantity: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  code: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  receiverName: string;
  phone: string;
  addressLine: string;
  paymentMethod: 'cod' | 'bank-transfer' | 'momo';
}

export interface Coupon {
  code: string;
  label: string;
  /** 'percent' giảm theo %, 'amount' giảm số tiền cố định, 'shipping' miễn phí ship */
  type: 'percent' | 'amount' | 'shipping';
  value: number;
  minSubtotal: number;
  maxDiscount?: number;
  expiresAt: string;
}

/* ---------- Blog ---------- */
export interface BlogSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
  quote?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: string;
  tags: string[];
  authorName: string;
  publishedAt: string;
  readingMinutes: number;
  viewCount: number;
  sections: BlogSection[];
}

/* ---------- Truy vấn danh sách sản phẩm ---------- */
export const PRODUCT_SORTS = [
  'newest',
  'price-asc',
  'price-desc',
  'best-selling',
  'g-power-desc',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductQuery {
  keyword?: string;
  attributes?: BakuganAttribute[];
  series?: BakuganSeries[];
  conditions?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  minGPower?: number;
  maxGPower?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

/* ---------- Kiểu phản hồi API chung (khớp với backend tương lai) ---------- */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContactMessage {
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

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

/** Phụ kiện đi kèm (thẻ Gate, thẻ năng lực…) — dùng cho món đấu giá */
export interface ProductAccessory {
  name: string;
  included: boolean;
}

/* ---------- Feed bán hàng ---------- */
/*
 * Shop nhập Bakugan theo lô, không phải hàng sản xuất hàng loạt: mỗi con một
 * tình trạng riêng nên không có "số lượng". Mỗi lô được đăng thành một feed
 * (ảnh chụp cả lô + danh sách từng con). Con nào bán rồi hiện SOLD.
 */

export const ITEM_STATUSES = ['available', 'sold'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Một con Bakugan duy nhất */
export interface BakuganItem {
  id: string;
  /** Mã Bakugan duy nhất, VD "BK-0231" — phần thứ hai sau tên */
  code: string;
  /** Tên do chủ shop đặt */
  name: string;
  price: number;
  attribute: BakuganAttribute;
  /** Dòng / đời (có thể không rõ với hàng lô) */
  series?: BakuganSeries;
  condition: ProductCondition;
  /** Tình trạng riêng của con này: trầy nhẹ, lỏng khớp, thiếu thẻ… */
  conditionNote?: string;
  gPower?: number;
  /** Ảnh riêng của con này; chưa có ảnh thì rỗng (giao diện để khung trống) */
  image: string;
  hasOwnPhoto: boolean;
  status: ItemStatus;
  soldAt?: string;
  /** Feed đang chứa con này; trống nghĩa là hàng tồn chưa được đăng lại */
  feedId?: string;
  feedNumber?: number;
  feedTitle?: string;
  /** Giờ mở bán của feed chứa con này */
  feedOpensAt?: string;
  /** Còn bán và feed đã tới giờ mở bán — khách đặt được ngay */
  onSale: boolean;
  createdAt: string;
}

/**
 * - `upcoming` : đã đăng nhưng chưa tới giờ mở bán — khách xem trước danh sách
 * - `selling`  : đang bán, còn ít nhất một con
 * - `sold-out` : tất cả đã bán
 */
export type FeedStatus = 'upcoming' | 'selling' | 'sold-out';

export interface FeedPost {
  id: string;
  /** Số thứ tự tăng dần, dùng trong đường dẫn: /feed/28 */
  number: number;
  title: string;
  caption: string;
  /** Ảnh chụp cả lô, ảnh đầu tiên là ảnh bìa; rỗng khi chưa có ảnh */
  images: string[];
  publishedAt: string;
  /** Giờ mở bán — trước giờ này chưa đặt mua được */
  opensAt: string;
  status: FeedStatus;
  itemCount: number;
  soldCount: number;
  /** Lúc con cuối cùng được bán (khi đã bán hết) */
  soldOutAt?: string;
  /** Giá thấp nhất – cao nhất của những con còn bán */
  priceRange?: { min: number; max: number };
  items: BakuganItem[];
}

export const FEED_STATUS_FILTERS = ['all', 'selling', 'upcoming', 'sold-out'] as const;
export type FeedStatusFilter = (typeof FEED_STATUS_FILTERS)[number];

export interface FeedQuery {
  status?: FeedStatusFilter;
  /** Tìm theo tên / mã Bakugan hoặc tiêu đề feed */
  keyword?: string;
  attribute?: BakuganAttribute;
  limit?: number;
}

/** Tìm Bakugan trên toàn bộ feed (ô tìm kiếm, bộ lọc hệ, trợ lý tư vấn) */
export interface ItemQuery {
  keyword?: string;
  attributes?: BakuganAttribute[];
  conditions?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  /** Mặc định chỉ con còn bán */
  includeSold?: boolean;
  limit?: number;
}

/* ---------- Đấu giá ---------- */
export type AuctionStatus = 'upcoming' | 'live' | 'ended';

/** Một lượt đặt giá đầy đủ — chỉ server và trang quản trị thấy người đặt là ai. */
export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  createdAt: string;
  /** Lượt đặt này có kích hoạt gia hạn chống bắn tỉa hay không */
  triggeredExtension?: boolean;
}

/** Lượt đặt của chính người đang xem */
export interface MyBid {
  amount: number;
  createdAt: string;
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

/**
 * Phiên đấu giá như khách thấy. Không công khai tên hay danh sách người đặt:
 * chỉ có giá cao nhất, số lượt và số người đã đặt (hình cây búa).
 */
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
  /** Số người khác nhau đã đặt giá */
  bidderCount: number;
  watcherCount: number;
  attribute: BakuganAttribute;
  series: BakuganSeries;
  gPower: number;
  condition: ProductCondition;
  accessories: ProductAccessory[];
  /** Lượt đặt của chính người đang xem (mới nhất trước) */
  myBids: MyBid[];
  /** Người đang xem có đang giữ giá cao nhất không */
  viewerIsLeading: boolean;
}

/** Bản đầy đủ của phiên — chỉ server và trang quản trị có */
export interface AuctionRecord extends Omit<Auction, 'myBids' | 'viewerIsLeading' | 'bidderCount'> {
  bids: Bid[];
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

export const USER_ROLES = ['customer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type Gender = 'male' | 'female' | 'other';

/**
 * Tài khoản nhận hoàn tiền của khách. Chỉ chính chủ nhìn thấy số tài khoản;
 * API quản trị không bao giờ trả trường `accountNumber` ra ngoài.
 */
export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/* ---------- Hạng thành viên ---------- */
export const MEMBER_LEVELS = [1, 2] as const;
export type MemberLevel = (typeof MEMBER_LEVELS)[number];

/** Vì sao được lên hạng: mua đủ số Bakugan, nạp tiền, hay admin duyệt */
export type LevelSource = 'purchases' | 'deposit' | 'admin';

export type MembershipRequestKind = 'deposit' | 'review';
export type MembershipRequestStatus = 'pending' | 'approved' | 'rejected';

export interface MembershipRequest {
  id: string;
  userId: string;
  /** `deposit`: đã chuyển khoản nạp tiền · `review`: nhờ admin xét duyệt */
  kind: MembershipRequestKind;
  amount?: number;
  /** Nội dung chuyển khoản để admin đối soát */
  transferNote?: string;
  message?: string;
  status: MembershipRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNote?: string;
}

export interface ShopBankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/** Hạng của khách đang đăng nhập và cách để lên hạng */
export interface MembershipInfo {
  level: MemberLevel;
  source?: LevelSource;
  levelUpAt?: string;
  /** Số Bakugan đã nhận (đơn hoàn tất) */
  purchasedCount: number;
  /** Mua đủ ngần này con thì tự lên Lv2 */
  purchaseGoal: number;
  /** Số tiền nạp để lên Lv2 (admin đặt) */
  depositAmount: number;
  /** Tổng tiền đã nạp */
  depositBalance: number;
  pendingRequest?: MembershipRequest;
  /** Nội dung chuyển khoản khách cần ghi khi nạp tiền */
  transferNote: string;
  /** Tài khoản nhận tiền của shop — trống nếu admin chưa nhập */
  bank: ShopBankInfo | null;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  createdAt: string;
  addresses: Address[];
  /** Phiên đăng nhập cũ (trước khi có phân quyền) có thể thiếu — coi như khách hàng */
  role: UserRole;
  birthday?: string;
  gender?: Gender;
  bankAccount?: BankAccount;
  /** Thiếu = Lv1 */
  memberLevel?: MemberLevel;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/* ---------- Giỏ hàng & Đơn hàng ---------- */
/** Mỗi con Bakugan là duy nhất nên không có số lượng */
export interface CartItem {
  itemId: string;
  code: string;
  name: string;
  image: string;
  price: number;
  attribute: BakuganAttribute;
  condition: ProductCondition;
  feedNumber?: number;
}

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'packing',
  'shipping',
  'completed',
  'cancelled',
  'returned',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['cod', 'bank-transfer', 'momo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Đơn đến từ đâu: khách tự đặt trên web, thắng đấu giá, hay admin tạo tay */
export const ORDER_SOURCES = ['web', 'auction', 'manual'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const CANCEL_REASONS = [
  'customer-request',
  'out-of-stock',
  'payment-timeout',
  'unreachable',
  'duplicate',
  'fraud-suspected',
  'other',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export interface OrderItem {
  /** Id con Bakugan, hoặc `auction:<id>` với món thắng đấu giá */
  itemId: string;
  /** Mã Bakugan (món đấu giá không có) */
  code?: string;
  name: string;
  image: string;
  price: number;
}

/** Một mốc trong lịch sử đơn — ai đổi trạng thái, lúc nào, ghi chú gì */
export interface OrderEvent {
  id: string;
  status: OrderStatus;
  at: string;
  actor: string;
  note?: string;
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
  updatedAt: string;
  receiverName: string;
  phone: string;
  addressLine: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  source: OrderSource;
  /** Khách lẻ (admin tạo tay) không có tài khoản thì để trống */
  userId?: string;
  customerEmail?: string;
  auctionId?: string;
  note?: string;
  cancelReason?: CancelReason;
  cancelNote?: string;
  timeline: OrderEvent[];
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

export * from './admin';
export * from './chat';

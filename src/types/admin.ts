/* ============================================================
   Kiểu dữ liệu riêng cho khu vực quản trị
   ============================================================ */
import type {
  Address,
  AuctionRecord,
  BakuganItem,
  FeedPost,
  Gender,
  InternationalShippingSettings,
  LevelSource,
  MemberLevel,
  MembershipRequest,
  Order,
  OrderStatus,
  ShopBankInfo,
  UserRole,
} from './index';

/* ---------- Khách hàng ---------- */
export type AccountStatus = 'active' | 'locked';

export interface AdminCustomerStats {
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  /** Tổng tiền các đơn không bị huỷ / hoàn */
  totalSpent: number;
  lastOrderAt?: string;
  auctionBidCount: number;
  auctionWinCount: number;
  /** Số Bakugan đã nhận (đơn hoàn tất) — đủ 3 con thì lên Lv2 */
  purchasedItemCount: number;
}

/**
 * Hồ sơ khách mà admin được xem.
 *
 * Được dựng bằng cách *chọn từng trường cho phép* chứ không phải xoá bớt trường
 * nhạy cảm, nên sau này thêm dữ liệu mật vào User cũng không tự lọt ra đây.
 * Số tài khoản ngân hàng không có mặt trong kiểu này.
 */
export interface AdminCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: UserRole;
  status: AccountStatus;
  lockedReason?: string;
  createdAt: string;
  lastLoginAt?: string;
  birthday?: string;
  gender?: Gender;
  addresses: Address[];
  tags: string[];
  adminNote: string;
  /** Khách có liên kết ngân hàng hay không — chỉ tên ngân hàng và chủ tài khoản */
  bankLink: { bankName: string; accountHolder: string } | null;
  memberLevel: MemberLevel;
  levelSource?: LevelSource;
  levelUpAt?: string;
  depositBalance: number;
  pendingLevelRequest?: MembershipRequest;
  stats: AdminCustomerStats;
}

export interface AdminCustomerDetail extends AdminCustomer {
  orders: Order[];
  auctions: Array<{
    auctionId: string;
    title: string;
    myHighestBid: number;
    bidCount: number;
    isWinning: boolean;
    status: AuctionRecord['status'];
  }>;
  levelRequests: MembershipRequest[];
}

/* ---------- Feed & từng con Bakugan ---------- */
/** Web chỉ lưu tối đa ngần này feed; đăng feed mới khi đã đủ thì phải xoá feed cũ nhất. */
export const FEED_LIMIT = 30;

/** Con Bakugan như admin thấy: có thêm thông tin đơn / người mua và giá nhập. */
export interface AdminItem extends BakuganItem {
  /** Bán qua đơn trên web / admin tạo, hay admin tự đánh dấu (chốt qua Messenger, bán tại shop) */
  soldVia?: 'order' | 'manual';
  orderId?: string;
  orderCode?: string;
  buyerName?: string;
  soldNote?: string;
}

export interface AdminFeed extends Omit<FeedPost, 'items'> {
  items: AdminItem[];
  /** Tổng tiền những con đã bán */
  revenue: number;
  /** Giá nhập cả lô (tuỳ chọn) — để tính lãi tạm */
  lotCost?: number;
  supplier?: string;
}

/** Feed sẽ bị xoá khi đăng feed thứ 31, kèm những con chưa bán trong đó. */
export interface FeedLimitCheck {
  feedCount: number;
  limit: number;
  /** Có khi web đã đủ feed: feed cũ nhất sẽ phải xoá để đăng feed mới */
  oldest?: {
    id: string;
    number: number;
    title: string;
    publishedAt: string;
    itemCount: number;
    soldCount: number;
    leftovers: Array<Pick<BakuganItem, 'id' | 'code' | 'name' | 'price'>>;
  };
}

/* ---------- Sự cố đơn hàng ---------- */
export const ISSUE_TYPES = [
  'late-delivery',
  'damaged',
  'wrong-item',
  'lost',
  'payment',
  'unreachable',
  'other',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_STATUSES = ['open', 'investigating', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface OrderIssue {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  type: IssueType;
  status: IssueStatus;
  description: string;
  reportedBy: 'admin' | 'customer' | 'carrier';
  createdAt: string;
  updatedAt: string;
  resolution?: string;
}

/* ---------- Đấu giá ---------- */
/**
 * Khâu sau phiên đấu giá.
 * - `running`         : phiên chưa kết thúc
 * - `awaiting-order`  : đã có người thắng, chờ admin tạo đơn
 * - `order-created`   : đã tạo đơn cho người thắng
 * - `no-winner`       : kết thúc mà không ai đặt giá
 * - `forfeited`       : người thắng bỏ cọc / không thanh toán
 */
export type AuctionFulfillmentStatus =
  'running' | 'awaiting-order' | 'order-created' | 'no-winner' | 'forfeited';

export interface AuctionFulfillment {
  auctionId: string;
  status: Exclude<AuctionFulfillmentStatus, 'running' | 'awaiting-order' | 'no-winner'>;
  orderId?: string;
  note?: string;
  updatedAt: string;
}

export interface AdminAuctionRow {
  auction: AuctionRecord;
  fulfillment: AuctionFulfillmentStatus;
  orderId?: string;
  orderCode?: string;
  winner?: { id: string; fullName: string; email: string; phone: string; amount: number };
  note?: string;
}

/* ---------- Cài đặt ---------- */
export interface ShopSettings {
  /** Số tiền khách nạp để lên thành viên Lv2 (được đấu giá) */
  memberDepositAmount: number;
  /** Tài khoản nhận chuyển khoản của shop — hiện cho khách khi thanh toán / nạp tiền */
  bank: ShopBankInfo;
  /** Nhận thẻ Visa / Mastercard / JCB qua cổng thanh toán */
  cardPayments: boolean;
  /** Gửi hàng ra nước ngoài (đơn quốc tế chỉ trả bằng thẻ) */
  international: InternationalShippingSettings;
}

/* ---------- Tổng quan ---------- */
export interface DailyRevenuePoint {
  /** yyyy-mm-dd theo giờ Việt Nam */
  date: string;
  revenue: number;
  orders: number;
}

export interface DashboardStats {
  rangeDays: number;
  revenue: number;
  previousRevenue: number;
  orderCount: number;
  previousOrderCount: number;
  cancelRate: number;
  pendingOrders: number;
  statusCounts: Record<OrderStatus, number>;
  daily: DailyRevenuePoint[];
  feedCount: number;
  feedLimit: number;
  sellingFeeds: number;
  upcomingFeeds: number;
  /** Feed đã bán hết con cuối — để admin theo dõi / dọn */
  soldOutFeeds: Array<{
    id: string;
    number: number;
    title: string;
    itemCount: number;
    revenue: number;
    soldOutAt?: string;
  }>;
  availableItems: number;
  /** Số con bán được trong khoảng thời gian đang xem */
  soldItems: number;
  /** Hàng tồn từ feed đã xoá, chưa được đăng lại */
  leftoverItems: number;
  pendingLevelRequests: number;
  openIssues: number;
  waitingChats: number;
  awaitingAuctionOrders: number;
  customerCount: number;
  newCustomers: number;
}

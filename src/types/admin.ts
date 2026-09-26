/* ============================================================
   Kiểu dữ liệu riêng cho khu vực quản trị
   ============================================================ */
import type {
  Address,
  Auction,
  BakuganAttribute,
  Gender,
  Order,
  OrderStatus,
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
    status: Auction['status'];
  }>;
}

/* ---------- Kho & nhập hàng ---------- */
export interface StockReceiptItem {
  productId: string;
  productName: string;
  attribute: BakuganAttribute;
  quantity: number;
  /** Giá vốn một con */
  unitCost: number;
}

/** Phiếu nhập kho */
export interface StockReceipt {
  id: string;
  code: string;
  supplier: string;
  receivedAt: string;
  createdBy: string;
  note?: string;
  items: StockReceiptItem[];
  totalQuantity: number;
  totalCost: number;
}

export type StockLevel = 'in-stock' | 'low' | 'out';

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
  auction: Auction;
  fulfillment: AuctionFulfillmentStatus;
  orderId?: string;
  orderCode?: string;
  winner?: { id: string; fullName: string; email: string; phone: string; amount: number };
  note?: string;
}

/* ---------- Cài đặt ---------- */
export interface ShopSettings {
  /** Còn từ ngần này trở xuống thì báo "sắp hết hàng" */
  lowStockThreshold: number;
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
  stockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  openIssues: number;
  waitingChats: number;
  awaitingAuctionOrders: number;
  customerCount: number;
  newCustomers: number;
}

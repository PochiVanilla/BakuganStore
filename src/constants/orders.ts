import type {
  CancelReason,
  IssueStatus,
  IssueType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types';

export { ORDER_STATUS_LABELS } from './catalog';

/** Màu nhãn trạng thái đơn — dùng chung cho trang khách và trang quản trị. */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'border-warning/45 bg-warning/12 text-warning',
  confirmed: 'border-accent-cyan/45 bg-accent-cyan/12 text-accent-cyan',
  packing: 'border-accent-pink/45 bg-accent-pink/12 text-accent-pink',
  shipping: 'border-primary/50 bg-primary/15 text-primary-soft',
  completed: 'border-success/45 bg-success/12 text-success',
  cancelled: 'border-white/15 bg-white/5 text-text-muted',
  returned: 'border-danger/40 bg-danger/10 text-danger',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Thanh toán khi nhận hàng',
  'bank-transfer': 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
};

/** Nhãn ngắn cho cột bảng chật chỗ */
export const PAYMENT_METHOD_SHORT_LABELS: Record<PaymentMethod, string> = {
  cod: 'COD',
  'bank-transfer': 'Chuyển khoản',
  momo: 'MoMo',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

export const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: 'text-warning',
  paid: 'text-success',
  refunded: 'text-text-muted',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  web: 'Đặt trên web',
  auction: 'Thắng đấu giá',
  manual: 'Admin tạo',
};

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  'customer-request': 'Khách yêu cầu huỷ',
  'out-of-stock': 'Hết hàng / hàng lỗi',
  'payment-timeout': 'Quá hạn thanh toán',
  unreachable: 'Không liên lạc được / bom hàng',
  duplicate: 'Đơn trùng',
  'fraud-suspected': 'Nghi ngờ gian lận',
  other: 'Lý do khác',
};

/**
 * Trạng thái kế tiếp hợp lệ. Server kiểm tra lại đúng bảng này nên không thể
 * nhảy cóc (VD: từ "Chờ xác nhận" sang thẳng "Hoàn tất").
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packing', 'cancelled'],
  packing: ['shipping', 'cancelled'],
  shipping: ['completed', 'returned'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};

/** Các trạng thái admin cần làm gì đó */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'confirmed', 'packing'];

/** Đơn không tính vào doanh thu */
export const VOID_ORDER_STATUSES: readonly OrderStatus[] = ['cancelled', 'returned'];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  'late-delivery': 'Giao trễ',
  damaged: 'Hàng hư hỏng',
  'wrong-item': 'Giao sai hàng',
  lost: 'Thất lạc',
  payment: 'Lỗi thanh toán',
  unreachable: 'Không liên lạc được khách',
  other: 'Khác',
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Mới báo',
  investigating: 'Đang xử lý',
  resolved: 'Đã giải quyết',
};

export const ISSUE_STATUS_STYLES: Record<IssueStatus, string> = {
  open: 'border-danger/45 bg-danger/12 text-danger',
  investigating: 'border-warning/45 bg-warning/12 text-warning',
  resolved: 'border-success/45 bg-success/12 text-success',
};

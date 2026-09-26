import type { BotTopicId } from '@/types';

/** Mô tả từng việc admin có thể giao cho trợ lý AI (hiện ở trang cài đặt). */
export const BOT_TOPIC_META: Record<
  BotTopicId,
  { label: string; description: string; example: string }
> = {
  'order-status': {
    label: 'Tra cứu đơn hàng',
    description: 'Bot đọc đơn của chính khách đang chat (khách phải đăng nhập) và báo trạng thái.',
    example: '“Đơn TD2609A17 của mình tới đâu rồi?”',
  },
  shipping: {
    label: 'Phí & thời gian giao hàng',
    description: 'Phí ship 30.000₫, miễn phí từ 800.000₫, thời gian giao theo khu vực.',
    example: '“Ship ra Hà Nội mất mấy ngày?”',
  },
  payment: {
    label: 'Cách thanh toán',
    description: 'COD, chuyển khoản, MoMo và thời hạn thanh toán.',
    example: '“Shop nhận MoMo không?”',
  },
  returns: {
    label: 'Chính sách đổi trả',
    description:
      'Giải thích điều kiện đổi trả 7 ngày. Yêu cầu đổi trả một đơn cụ thể vẫn chuyển nhân viên.',
    example: '“Hàng lỗi nam châm có đổi được không?”',
  },
  'auction-rules': {
    label: 'Luật đấu giá',
    description: 'Chống bắn tỉa, phiên kín, bước giá, hạn thanh toán 48 giờ.',
    example: '“Sao phiên cứ tự cộng thêm giờ?”',
  },
  'product-info': {
    label: 'Tư vấn sản phẩm & tồn kho',
    description: 'Giá, còn hàng hay không, hệ, dòng, tình trạng, G-Power của hàng đang bán.',
    example: '“Còn Dragonoid hệ Pyrus không?”',
  },
  'store-info': {
    label: 'Địa chỉ & giờ mở cửa',
    description: 'Địa chỉ shop, giờ làm việc, hotline, Zalo.',
    example: '“Shop ở đâu, mấy giờ đóng cửa?”',
  },
  promotions: {
    label: 'Mã giảm giá',
    description: 'Đọc danh sách mã giảm giá đang chạy cho khách.',
    example: '“Có mã freeship không shop?”',
  },
};

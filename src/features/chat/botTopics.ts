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
  'order-cancel': {
    label: 'Tự huỷ đơn chưa xác nhận',
    description:
      'Khách đã đăng nhập nhắn "huỷ đơn" → bot hỏi lại rồi tự huỷ, các con trong đơn được mở bán lại. Chỉ áp dụng đơn "Chờ xác nhận" chưa thanh toán; đơn khác vẫn chuyển nhân viên.',
    example: '“Mình muốn huỷ đơn TD2609A17”',
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
    description: 'Chống bắn tỉa, phiên kín, ẩn tên người đặt, bước giá, hạn thanh toán 48 giờ.',
    example: '“Sao phiên cứ tự cộng thêm giờ?”',
  },
  'product-info': {
    label: 'Feed bán & tư vấn chọn Bakugan',
    description:
      'Feed nào đang / sắp mở bán, con nào còn hay đã SOLD, giá, hệ, tình trạng. Hỏi khách mới từng bước (mục đích, hệ, ngân sách, tình trạng) rồi gợi ý con phù hợp.',
    example: '“Còn Dragonoid hệ Pyrus không?”, “Tư vấn giúp mình chọn Bakugan”',
  },
  'bakugan-knowledge': {
    label: 'Kiến thức Bakugan',
    description: 'Giải thích Bakugan là gì, 6 hệ, các dòng, G-Power, cách chơi cơ bản.',
    example: '“G-Power là gì?”, “Chơi Bakugan thế nào?”',
  },
  membership: {
    label: 'Hạng thành viên (Lv2)',
    description:
      'Giải thích ba cách lên Lv2 để được đấu giá và cho khách đã đăng nhập biết mình đang ở đâu. Xác nhận khoản nạp hay duyệt hạng vẫn do admin làm.',
    example: '“Sao mình không đặt giá được?”, “Lên Lv2 thế nào?”',
  },
  'store-info': {
    label: 'Thông tin shop',
    description:
      'Địa chỉ, giờ làm việc, hotline, Zalo, cam kết hàng chính hãng, cách đăng ký tài khoản.',
    example: '“Shop ở đâu, mấy giờ đóng cửa?”',
  },
  promotions: {
    label: 'Mã giảm giá',
    description: 'Đọc danh sách mã giảm giá đang chạy cho khách.',
    example: '“Có mã freeship không shop?”',
  },
};

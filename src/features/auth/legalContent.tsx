/**
 * Nội dung pháp lý dùng chung cho modal (trang đăng ký) và trang riêng
 * /dieu-khoan, /chinh-sach-bao-mat — viết một lần, dùng hai nơi.
 */

function Article({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-2 font-display text-sm font-bold text-text">{title}</h3>
      <ul className="space-y-1.5 pl-4">
        {items.map((item) => (
          <li key={item} className="list-disc text-sm leading-relaxed text-text-muted">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TermsContent() {
  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-text-muted">
        Khi tạo tài khoản và sử dụng website TD Bakugan, bạn đồng ý với các điều khoản dưới đây. Vui
        lòng đọc kỹ trước khi tiếp tục.
      </p>

      <Article
        title="1. Tài khoản người dùng"
        items={[
          'Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động phát sinh từ tài khoản của mình.',
          'Thông tin đăng ký phải chính xác, đặc biệt là số điện thoại dùng để liên hệ giao hàng.',
          'Mỗi người chỉ nên sử dụng một tài khoản. Tài khoản có dấu hiệu gian lận đấu giá sẽ bị khoá.',
        ]}
      />

      <Article
        title="2. Đặt hàng và thanh toán"
        items={[
          'Đơn hàng được xác nhận qua điện thoại hoặc Zalo trong vòng 24 giờ làm việc.',
          'Giá hiển thị đã bao gồm thuế, chưa bao gồm phí vận chuyển (nếu có).',
          'Shop có quyền từ chối đơn hàng nếu sản phẩm hết hàng hoặc có sai sót về giá do lỗi kỹ thuật.',
        ]}
      />

      <Article
        title="3. Quy định đấu giá"
        items={[
          'Chỉ tài khoản đã đăng nhập mới được đặt giá.',
          'Mỗi lượt đặt phải cao hơn giá hiện tại ít nhất một bước giá đã công bố.',
          'Lượt đặt giá là cam kết mua — không thể huỷ sau khi đã xác nhận.',
          'Người thắng phiên cần hoàn tất thanh toán trong 48 giờ, quá hạn sẽ mất lượt và có thể bị hạn chế tham gia các phiên sau.',
        ]}
      />

      <Article
        title="4. Sở hữu trí tuệ"
        items={[
          'Toàn bộ nội dung, hình ảnh và bài viết trên website thuộc quyền sở hữu của TD Bakugan.',
          'Tên thương hiệu và tên nhân vật thuộc về chủ sở hữu tương ứng; shop chỉ sử dụng để mô tả sản phẩm đang kinh doanh.',
        ]}
      />

      <Article
        title="5. Thay đổi điều khoản"
        items={[
          'TD Bakugan có thể cập nhật điều khoản này và sẽ thông báo trên website trước khi áp dụng.',
          'Việc tiếp tục sử dụng dịch vụ sau khi cập nhật đồng nghĩa với việc bạn chấp nhận nội dung mới.',
        ]}
      />
    </div>
  );
}

export function PrivacyContent() {
  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-text-muted">
        TD Bakugan tôn trọng quyền riêng tư của bạn. Tài liệu này giải thích chúng tôi thu thập
        thông tin gì, dùng để làm gì và bạn kiểm soát nó ra sao.
      </p>

      <Article
        title="1. Thông tin chúng tôi thu thập"
        items={[
          'Thông tin bạn cung cấp: họ tên, email, số điện thoại, địa chỉ giao hàng.',
          'Thông tin giao dịch: lịch sử đơn hàng, lịch sử đặt giá trong các phiên đấu giá.',
          'Dữ liệu kỹ thuật: loại thiết bị, trình duyệt và các trang bạn đã xem để cải thiện trải nghiệm.',
        ]}
      />

      <Article
        title="2. Mục đích sử dụng"
        items={[
          'Xử lý đơn hàng, xác nhận và giao hàng tới đúng địa chỉ.',
          'Thông báo kết quả đấu giá và cảnh báo khi bạn bị vượt giá.',
          'Gửi tin về hàng mới hoặc khuyến mãi — chỉ khi bạn chủ động đăng ký nhận tin.',
        ]}
      />

      <Article
        title="3. Chia sẻ dữ liệu"
        items={[
          'Chúng tôi không bán hoặc cho thuê dữ liệu cá nhân của bạn cho bên thứ ba.',
          'Chỉ chia sẻ thông tin cần thiết cho đơn vị vận chuyển để giao hàng.',
          'Có thể cung cấp thông tin khi cơ quan nhà nước có thẩm quyền yêu cầu theo quy định pháp luật.',
        ]}
      />

      <Article
        title="4. Bảo mật"
        items={[
          'Mật khẩu được mã hoá một chiều, đội ngũ shop không thể đọc được mật khẩu của bạn.',
          'Kết nối tới website được bảo vệ bằng HTTPS.',
          'Chúng tôi chỉ lưu trữ dữ liệu trong thời gian cần thiết cho mục đích đã nêu.',
        ]}
      />

      <Article
        title="5. Quyền của bạn"
        items={[
          'Yêu cầu xem, sửa hoặc xoá dữ liệu cá nhân bất cứ lúc nào.',
          'Huỷ đăng ký nhận tin bằng một cú nhấp trong email hoặc trong trang Cài đặt tài khoản.',
          'Liên hệ hello@tdbakugan.vn nếu bạn có thắc mắc về việc xử lý dữ liệu.',
        ]}
      />
    </div>
  );
}

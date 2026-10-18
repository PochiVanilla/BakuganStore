# 10 · Giai đoạn 6: cài đặt, hạng thành viên, khách hàng, tổng quan và báo cáo thật trên MySQL

| Mục | Nội dung |
| --- | --- |
| Ngày | 18/10/2026 |
| Giai đoạn | 6 — **xong** (một phần của việc "bỏ dữ liệu giả lập, lưu thật trên MySQL") |
| Đã làm | Trang Cài đặt (shop + bot), hạng thành viên của khách (nạp tiền, xin xét duyệt), quản lý khách hàng (hồ sơ, khoá, quyền, đặt hạng, duyệt yêu cầu Lv2, gửi email đặt lại mật khẩu), trang Tổng quan, báo cáo huỷ đơn & sự cố, số đếm trên menu admin |
| Kết quả kiểm tra | 134/134 test backend trên MySQL 8.4 (11 test mới). Trình duyệt thật, web chạy dữ liệu thật: 9/9 |
| Web đang chạy | Vẫn **giả lập** cho tới giai đoạn 9 |
| Việc tiếp theo | Giai đoạn 7: đấu giá + WebSocket, đơn cho người thắng. Giai đoạn 8: chat + bot ở server, blog, liên hệ, nhận tin |

## 1. Chủ shop dùng thế nào

Màn hình không đổi. Những gì admin lưu giờ nằm trong MySQL:

- **Cài đặt**:
  - Tài khoản nhận chuyển khoản: hiện cho khách khi chọn chuyển khoản / nạp tiền lên Lv2.
  - Số tiền nạp lên Lv2.
  - Bật / tắt thẻ, giao quốc tế và phí gửi.
  - Lời thoại và chủ đề của bot.
  - Thẻ chỉ thật sự bật khi backend có cổng thanh toán (`CARD_GATEWAY`, xem tài liệu 09).
- **Hạng thành viên**: khách tự gửi "đã nạp tiền" hoặc "nhờ admin duyệt"; admin duyệt / từ chối trong
  trang chi tiết khách. Duyệt yêu cầu nạp tiền thì cộng số tiền vào "tiền đã nạp" của khách.
  Khách nhận đủ 3 Bakugan (đơn hoàn tất) thì tự lên Lv2 như trước.
- **Khoá tài khoản**: phải ghi lý do. Khách bị đăng xuất ở mọi nơi ngay lập tức.
- **Đặt lại mật khẩu**: admin chỉ bấm gửi email cho khách, không bao giờ tự đặt mật khẩu hộ.
- **Số tài khoản ngân hàng của khách**: admin không bao giờ xem được (chỉ thấy tên ngân hàng và chủ tài khoản).

## 2. Đã làm

| API (`/api/…`) | Làm gì |
| --- | --- |
| `GET` / `PATCH /admin/settings/shop` | Đọc / lưu từng phần cài đặt shop, kiểm tra như web (số tài khoản 6–20 chữ số, phí 0–20 triệu, tỉ giá 1.000–100.000). Tắt thẻ thì tắt luôn giao quốc tế. Khoá dòng cài đặt khi lưu để hai khung lưu cùng lúc không đè nhau |
| `GET` / `PUT /admin/settings/bot` | Cài đặt bot: đủ 11 chủ đề, lời chào và câu chuyển nhân viên tối đa 300 ký tự, ghi chú cho bot tối đa 1.500 |
| `GET /me/membership` | Hạng, số con đã nhận, số tiền nạp, nội dung chuyển khoản `TDLV2 <SĐT>`, tài khoản nhận tiền của shop, yêu cầu đang chờ |
| `POST /me/membership/deposit`, `/review`, `DELETE /me/membership/request` | Gửi / rút yêu cầu lên Lv2. Mỗi khách tối đa một yêu cầu đang chờ (UNIQUE trong CSDL). Tài khoản admin không cần lên hạng |
| `GET /admin/customers`, `GET /admin/customers/:id` | Danh sách (lọc trạng thái, quyền, hạng, "có yêu cầu Lv2"; tìm không dấu; sắp theo đăng nhập gần nhất / tiền đã chi / số đơn / tên) và chi tiết (đơn, đấu giá đã tham gia, lịch sử yêu cầu Lv2). Số liệu tính bằng SQL gom nhóm |
| `PATCH /admin/customers/:id` | Sửa họ tên, email (trùng → 409), SĐT, nhãn (tối đa 8), ghi chú |
| `PATCH …/status`, `…/role`, `…/level` | Khoá (bắt buộc lý do, thu hồi mọi phiên) / mở khoá; đổi quyền; đặt hạng (đóng yêu cầu xét duyệt đang chờ). Không tự khoá / tự đổi quyền chính mình |
| `POST /admin/customers/:id/password-reset` | Gửi email đặt lại mật khẩu (dùng đúng luồng "quên mật khẩu", tối đa 3 thư / giờ) |
| `POST /admin/membership-requests/:id/approve` \| `reject` | Duyệt (nạp tiền thì cộng tiền nạp) / từ chối (bắt buộc lý do); yêu cầu đã xử lý → 409 |
| `GET /admin/dashboard?days=` | Doanh thu (không tính đơn huỷ / hoàn) so với kỳ trước, số đơn theo trạng thái, doanh thu 14 ngày theo giờ Việt Nam, feed, hàng, khách mới, việc cần xử lý |
| `GET /admin/reports/problems?days=` | Đơn huỷ / hoàn, lý do huỷ, tỉ lệ huỷ, doanh thu mất, sự cố (sự cố chưa xong luôn hiện) |
| `GET /admin/badges` | Số đếm trên menu admin, đệm 5 giây |

- **Hồ sơ khách cho admin** được dựng bằng cách chọn từng trường cho phép.
- Bảng ngân hàng chỉ đọc tên ngân hàng và chủ tài khoản. Test kiểm tra cả số đầy đủ lẫn 4 số cuối đều không có trong dữ liệu trả về.
- Mọi thao tác ghi nhật ký admin. Nhật ký cài đặt không ghi số tài khoản.

## 3. Khác với bản giả lập

| Chỗ | Bản thật làm | Lý do |
| --- | --- | --- |
| Khoá tài khoản | Thu hồi mọi phiên đăng nhập của khách ngay | Khách đang mở web cũng bị đăng xuất, không chờ token hết hạn |
| Danh sách khách | Tối đa 1.000 tài khoản mỗi lần lọc | Đủ cho shop; khi đông hơn sẽ thêm phân trang |
| Đấu giá, tin nhắn trong số liệu | Đã đọc từ bảng thật (hiện là 0) | Phần đấu giá và chat chạy thật ở giai đoạn 7–8 |

## 4. Kiểm thử

**Backend** (`test/integration/admin-phase6.test.ts`, 11 test), cùng 123 test cũ: 134/134 qua.

| Nhóm | Thử gì |
| --- | --- |
| Cài đặt | Chỉ admin; số tài khoản sai → lỗi ở ô; lưu → trang thanh toán và `/shop/bank` đổi theo; tắt thẻ tắt quốc tế; tỉ giá sai; bot thiếu chủ đề / quá dài |
| Hạng | Thông tin hạng, nội dung chuyển khoản; một yêu cầu mỗi lúc; rút lại; lý do quá ngắn; admin không cần lên hạng; duyệt nạp tiền → Lv2 + tiền nạp; từ chối phải có lý do; đã xử lý → 409 |
| Khách hàng | Số liệu đơn, tìm không dấu, lọc "có yêu cầu Lv2"; chi tiết không lộ số tài khoản; đặt hạng đóng yêu cầu; email trùng; nhãn bỏ trùng; khoá phải có lý do và đăng xuất ngay; không tự khoá / tự đổi quyền; gửi email đặt lại mật khẩu |
| Báo cáo | Tổng quan (doanh thu, 14 ngày, trạng thái, feed, khách); báo cáo huỷ đơn; số đếm menu |

**Trình duyệt thật** (web `VITE_USE_MOCK=false`), 9/9 qua:

1. Khách mới mở trang Hạng thành viên (đọc từ MySQL), gửi yêu cầu xét duyệt.
2. Admin mở Tổng quan, Khách hàng, chi tiết khách, bấm "Duyệt lên Lv2" → khách lên Lv2.
3. Admin nhập tài khoản nhận tiền trong Cài đặt → lưu vào MySQL (số viết liền, tên viết hoa).
4. Trang Huỷ & sự cố mở được. Các trang admin của giai đoạn này không còn gọi API lỗi; còn lại
   chỉ là đấu giá, chat, blog (giai đoạn 7–8).

## 5. Việc tiếp theo

- **Giai đoạn 7**: đấu giá (đặt giá khoá dòng, chống bắn tỉa, phiên kín không lộ giá), WebSocket,
  admin tạo / sửa phiên, đơn cho người thắng, bỏ cọc.
- **Giai đoạn 8**: chat khách – shop + bot chạy ở server, blog, liên hệ, nhận tin.

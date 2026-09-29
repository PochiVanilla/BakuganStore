# 02 · Điều chỉnh kế hoạch: MySQL, lưu ảnh trên máy, tự chạy trên mini PC

| Mục | Nội dung |
| --- | --- |
| Ngày | 29/09/2026 |
| Giai đoạn | 0 — Lập kế hoạch (bản 2). **Chưa viết code.** |
| Đã làm | Sửa kế hoạch theo 3 quyết định của chủ shop; trả lời câu hỏi về bot Gemini khi không còn dùng Vercel |
| Kết quả | [01 · Kế hoạch](01-ke-hoach-backend.md) đã lên **bản 2**; [00 · Tổng hợp nhu cầu](00-tong-hop-nhu-cau.md) sửa 3 dòng cho khớp (kho file, tải video, nút thử bot) |
| Tiếp theo | Chờ duyệt bản 2 và 3 luật ở mục 1.8 của kế hoạch |

## Quyết định của chủ shop

1. **Cơ sở dữ liệu: MySQL** (thay PostgreSQL).
2. **Ảnh và video lưu trên ổ cứng của máy chủ**, không dùng Cloudflare.
3. **Nơi chạy: mini PC của shop**, mở cổng ra internet. Vercel chỉ là bản chạy tạm.

## Bot Gemini khi không còn Vercel

**Bây giờ, trên Vercel**
- Phần gọi Gemini là hàm `api/chat-bot.ts`. Nó chỉ chạy khi Vercel có biến `GEMINI_API_KEY`.
- Chưa đặt khoá thì bot **vẫn trả lời**, nhưng bằng bộ từ khoá dựng sẵn chứ không phải AI.
- Trang admin → Cài đặt → Trợ lý AI → **"Kiểm tra kết nối"** cho biết đúng lý do và cách sửa.
- Muốn có Gemini trên Vercel trong lúc chờ:
  1. Tạo khoá miễn phí ở aistudio.google.com/apikey.
  2. Vào Vercel → Settings → Environment Variables, thêm `GEMINI_API_KEY`.
  3. Redeploy.

**Sau khi chuyển sang mini PC**
- Backend Express nhận luôn đường `/api/chat-bot`, dùng lại nguyên file `api/chat-bot.ts`.
- Khoá Gemini để trong file `deploy/.env` trên mini PC, không bao giờ đưa xuống trình duyệt.
- Web đang gọi đúng đường này, nên chạy trên mini PC là bot có Gemini, không phải sửa giao diện.
- Việc này nằm ngay trong **giai đoạn 1**: bạn cài được web lên mini PC, có Gemini, dù các phần khác vẫn là dữ liệu giả lập.
- Về sau (giai đoạn 7), toàn bộ lượt trả lời của bot chạy trên server. Lúc đó `/api/chat-bot` chỉ còn cho admin dùng, để người ngoài không dùng ké hạn mức Gemini của shop.

**Nếu muốn đưa web lên mini PC trước cả khi có giai đoạn 1**
- Build web (`npm run build`) rồi cho Caddy hoặc Nginx trả thư mục `dist/` là chạy được.
- Chỉ có điều bot sẽ trả lời bằng bộ từ khoá, vì chưa có server nào nhận `/api/chat-bot`.

## Những gì đổi trong kế hoạch

| Phần | Bản 1 | Bản 2 | Ảnh hưởng |
| --- | --- | --- | --- |
| Cơ sở dữ liệu | PostgreSQL | **MySQL 8.4 LTS** (InnoDB) | Thuật toán khoá dòng giữ nguyên (`SELECT … FOR UPDATE`). Thay đổi: sequence → bảng `counters`; chỉ mục duy nhất một phần → cột sinh + UNIQUE; advisory lock → `GET_LOCK`; thời gian lưu UTC rồi đổi sang giờ Việt Nam bằng `CONVERT_TZ`; InnoDB báo deadlock thì tự thử lại |
| Ảnh, video | Cloudflare R2 + CDN | **Thư mục trên ổ mini PC**, Caddy trả file | Video tải qua backend theo luồng, không cần link có chữ ký. Thư mục ảnh phải được sao lưu mỗi đêm |
| Nơi chạy | Railway, Singapore | **Mini PC**, Docker Compose (Caddy + backend + MySQL) | Cần tên miền, IP công khai, mở cổng 80/443, UPS, ổ sao lưu |
| Web | Vercel | **Chạy luôn trên mini PC** (Caddy trả file đã build) | Web và API cùng tên miền nên không cần CORS; cookie đăng nhập đơn giản hơn |
| Realtime đấu giá | `LISTEN/NOTIFY` của PostgreSQL | Sự kiện trong bộ nhớ (một máy chủ) | Sau này nhiều máy thì thêm Redis |
| Bot Gemini | Hàm Vercel, chuyển vào backend ở giai đoạn 7 | Backend nhận `/api/chat-bot` **từ giai đoạn 1** | Có Gemini trên mini PC sớm |
| Email | Resend | **Gmail SMTP** (hoặc Resend) | Mạng nhà không gửi thư trực tiếp được |
| Giai đoạn 1 | Khung dự án | Khung + chạy trên mini PC + Gemini + hướng dẫn cài từng bước | Bạn chạy thử được trên mini PC ngay sau giai đoạn 1 |
| API mới | Có link tải video có chữ ký và 3 API thử bot riêng | Bỏ hết | Web ít phải sửa hơn |

## Chuẩn bị cho mini PC (trước khi chạy thử giai đoạn 1)

1. **Hệ điều hành**: khuyên Ubuntu Server 24.04 LTS. Windows vẫn chạy được nhưng kém ổn định khi chạy máy chủ 24/7.
2. **IP công khai**: vào trang quản trị của modem xem IP phía internet (WAN), so với IP hiện ở trang whatismyip.com.
   - Khác nhau, hoặc bắt đầu bằng `100.64.` đến `100.127.`: mạng đang dùng CGNAT, mở cổng không có tác dụng.
   - Khi đó gọi nhà mạng xin IP công khai.
3. **Tên miền**: mua một tên miền (VD `tdbakugan.vn`); nhà cung cấp tên miền cần cho sửa bản ghi DNS.
4. **Router**: có chức năng chuyển cổng (port forwarding); hỏi nhà mạng có chặn cổng 80/443 với gói đang dùng không.
5. **Bộ lưu điện (UPS)** cho mini PC và modem.
6. **Ổ cứng ngoài hoặc USB** để chứa bản sao lưu, và một tài khoản Google Drive (hoặc nơi khác) để giữ bản sao ngoài nhà.

## Vẫn chờ bạn

- Duyệt kế hoạch bản 2.
- Ba luật ở mục 1.8 của kế hoạch:
  - **(a)** Tự huỷ đơn chuyển khoản sau 24 giờ, chỉ khi đơn còn "Chờ xác nhận".
  - **(b)** Mã `TDNEW10` chỉ dùng cho đơn đầu tiên.
  - **(c)** Khách trả thẻ trễ: hàng còn thì giữ đơn; hàng đã bán cho người khác thì tự hoàn tiền.

# Tài liệu backend TD Bakugan

Backend của web TD Bakugan: **Express + TypeScript**, nằm trong thư mục `backend/` của repo này.
Frontend (React + Vite) vẫn ở thư mục gốc và deploy lên Vercel như cũ.

## Thông tin dự án

| Mục | Nội dung |
| --- | --- |
| Sản phẩm | Web bán Bakugan: mỗi con là hàng độc nhất, bán theo từng feed (lô hàng), có đấu giá, chat với shop kèm trợ lý AI, trang quản trị |
| Frontend | React 19 + Vite + TypeScript, dữ liệu giả lập trong trình duyệt (`VITE_USE_MOCK`), deploy Vercel từ nhánh `master` |
| Backend | Express 5 + TypeScript (Node.js 22 LTS trở lên), PostgreSQL, chạy riêng một server |
| Cách nối | Frontend đổi `VITE_USE_MOCK=false` + `VITE_API_BASE_URL` là gọi backend thật, không phải viết lại giao diện |
| Trạng thái | Giai đoạn 0 — đã khảo sát và lập kế hoạch, **chờ chủ shop duyệt** trước khi viết code |

## Quy ước

- **Mỗi lần làm backend thêm một file** trong thư mục này, đánh số theo thứ tự (`00-…`, `01-…`, `02-…`).
  File nào cũng mở đầu bằng bảng tóm tắt: ngày, giai đoạn, đã làm gì, kết quả kiểm tra, việc tiếp theo.
- **Chưa duyệt kế hoạch thì chưa viết code.** Giai đoạn nào đổi thiết kế so với kế hoạch thì ghi rõ lý do trong file của giai đoạn đó.
- Không bao giờ ghi khoá bí mật, mật khẩu, số thẻ hay số tài khoản thật vào tài liệu hoặc code.

## Mục lục

| File | Nội dung | Trạng thái |
| --- | --- | --- |
| [00-tong-hop-nhu-cau.md](00-tong-hop-nhu-cau.md) | Đọc lại frontend: dữ liệu, 96 API + kênh WebSocket đấu giá, luật nghiệp vụ, việc chạy nền, 10 lỗi/rò rỉ cần sửa | Xong |
| [01-ke-hoach-backend.md](01-ke-hoach-backend.md) | Kế hoạch chi tiết: công nghệ, cơ sở dữ liệu, thuật toán từng phần, bảo mật, kiểm thử, lộ trình | **Chờ duyệt** |

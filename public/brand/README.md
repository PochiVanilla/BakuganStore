# Ảnh thương hiệu

Logo tròn của shop (chữ TD tím, BAKUGAN cyan, trăng khuyết vàng) được dùng cho
header, footer, trang quản trị, khung chat và màn intro.

| File | Dùng ở đâu |
| --- | --- |
| `logo.png` | Ảnh gốc 495×495, nền trong suốt |
| `logo-96.webp`, `logo-192.webp`, `logo-320.webp` | Logo trên web (trình duyệt tự chọn cỡ hợp màn hình) |
| `icon-192.png`, `icon-512.png` | Icon khi lưu web ra màn hình điện thoại |
| `/favicon-32.png`, `/favicon-48.png`, `/apple-touch-icon.png` | Biểu tượng trên tab trình duyệt / iPhone |

## Đổi logo

Chuẩn bị ảnh vuông, logo nằm trong hình tròn chiếm gần hết ảnh, rồi thay các
file trên bằng ảnh mới **đúng tên, đúng kích thước** (có thể xuất từ Canva /
Photoshop, nền trong suốt cho các file `logo-*`).

```bash
git add public/brand public/favicon-*.png public/apple-touch-icon.png
git commit -m "doi logo"
git push
```

Vercel sẽ tự build lại và logo mới xuất hiện ngay.

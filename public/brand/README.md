# Ảnh thương hiệu

## dragon.png — hình rồng trong quả cầu trang chủ

Bỏ ảnh rồng của bạn vào đây với đúng tên `dragon.png`.

Website sẽ tự dùng ảnh này cho:

- quả cầu galaxy ở trang chủ
- logo trên header/footer
- màn intro khi mở web

Nếu không có file này, website tự quay về dùng hình rồng vẽ bằng vector
(`src/features/home/DragonEmblem.tsx`), nên trang không bao giờ bị lỗi.

### Yêu cầu ảnh

- Định dạng: PNG (nên có nền trong suốt) hoặc JPG
- Kích thước: vuông, tối thiểu 600×600, lý tưởng 1000×1000
- Nền trắng cũng dùng được: website tự tách hình khỏi nền trắng và tô lại
  bằng màu neon của shop, nên ảnh gốc màu gì cũng ra đúng tông thương hiệu

### Cách thêm

```bash
# chép ảnh vào đúng chỗ
cp ~/Downloads/rong.png public/brand/dragon.png

git add public/brand/dragon.png
git commit -m "them anh rong thuong hieu"
git push
```

Vercel sẽ tự build lại và ảnh xuất hiện ngay.

# Cửa ngõ dùng chung code với web

Backend chỉ được import code của web (`../src`, `../api`) **qua các file trong thư mục này**.
Mỗi file re-export đúng phần backend cần.

- Code web được dùng chung phải "thuần": không React, không DOM, không dữ liệu giả
  (`src/mocks`), không gọi API. Script `npm run check:shared` kiểm tra điều này
  (chạy trong bộ test).
- Ngoại lệ duy nhất: `blogSeed.ts` lấy nội dung 6 bài blog từ `src/mocks/blog.ts`
  (file chỉ chứa bài viết, không có tài khoản hay dữ liệu giả khác) để làm dữ liệu ban đầu.
- File web bên trong có thể import lẫn nhau bằng alias `@/…`; `tsconfig.json`,
  `tsup.config.ts` và `vitest.config.ts` của backend đều trỏ `@/` về `../src/`.

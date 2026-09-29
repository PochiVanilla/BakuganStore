import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // File web dùng chung import nhau bằng "@/…" — trỏ về thư mục src/ của web.
    alias: [{ find: /^@\//, replacement: fromRoot('../src/') }],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Các file test tích hợp dùng chung một CSDL thử nên chạy lần lượt.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});

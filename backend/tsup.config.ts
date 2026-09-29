import { defineConfig } from 'tsup';

/*
 * Đóng gói backend ra dist/. Code dùng chung với web (../src, ../api) được gói luôn
 * vào file chạy; thư viện trong package.json để ngoài, cài bằng `npm ci --omit=dev`.
 */
export default defineConfig({
  entry: ['src/server.ts', 'src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  tsconfig: 'tsconfig.json',
});

import { defineConfig } from 'drizzle-kit';

/*
 * `npm run db:generate` so sánh schema trong src/db/schema với các migration đã có
 * rồi sinh file SQL mới vào drizzle/. Không cần kết nối CSDL.
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});

# Backend TD Bakugan. Build từ GỐC repo vì cần cả code web dùng chung (src/, api/):
#   docker build -f backend/Dockerfile .
# (deploy/docker-compose.yml đã cấu hình sẵn.)

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --no-audit --no-fund
COPY src ./src
COPY api ./api
COPY backend ./backend
RUN cd backend && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
COPY backend/drizzle ./drizzle
# Thư mục ảnh / video (gắn ổ của mini PC vào đây). Chạy bằng tài khoản thường, không phải root.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "dist/server.js"]

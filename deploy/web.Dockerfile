# Web React build ra file tĩnh, Caddy trả file + nhận HTTPS + chuyển /api, /ws vào backend.
#   docker build -f deploy/web.Dockerfile .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.api.json ./
COPY public ./public
COPY src ./src
COPY api ./api
# Giai đoạn 1-8: web vẫn chạy dữ liệu giả lập (VITE_USE_MOCK=true). Giai đoạn 9 mới đổi false.
ARG VITE_USE_MOCK=true
ARG VITE_API_BASE_URL=/api
ARG VITE_WS_URL=
ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_URL=$VITE_WS_URL
RUN npm run build

FROM caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/www

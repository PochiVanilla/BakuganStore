import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const rootDir = path.dirname(new URL(import.meta.url).pathname);

type RouteHandler = (request: Request) => Response | Promise<Response>;

/**
 * Chạy thư mục api/ (Vercel Functions) ngay trong `npm run dev`, để thử bot
 * Gemini ở máy mình mà không cần cài Vercel CLI. Chỉ dùng khi phát triển.
 */
function devApiRoutes(): Plugin {
  return {
    name: 'td-dev-api-routes',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/chat-bot', (req, res) => {
        void (async () => {
          try {
            const mod = (await server.ssrLoadModule('/api/chat-bot.ts')) as Record<
              string,
              RouteHandler | undefined
            >;
            const handler = mod[req.method ?? 'GET'];
            if (!handler) {
              res.statusCode = 405;
              res.end();
              return;
            }
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const headers = new Headers();
            Object.entries(req.headers).forEach(([key, value]) => {
              if (typeof value === 'string') headers.set(key, value);
            });
            const request = new Request(`http://${req.headers.host ?? 'localhost'}/api/chat-bot`, {
              method: req.method,
              headers,
              body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
            });
            const response = await handler(request);
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
            server.config.logger.error(String(error));
            res.statusCode = 500;
            res.end();
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Biến không có tiền tố VITE_ chỉ nằm phía server (Node), không lọt vào bundle.
  const env = loadEnv(mode, rootDir, '');
  // (Gán undefined vào process.env sẽ thành chuỗi "undefined", nên chỉ gán khi có giá trị.)
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), tailwindcss(), devApiRoutes()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        output: {
          // Vite 8 chạy trên Rolldown: manualChunks phải là hàm.
          // Tách vendor để cache tốt hơn; các trang đã tự code-split qua React.lazy.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)
            ) {
              return 'vendor-react';
            }
            if (/[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/.test(id)) {
              return 'vendor-form';
            }
            if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) {
              return 'vendor-motion';
            }
            return undefined;
          },
        },
      },
    },
  };
});

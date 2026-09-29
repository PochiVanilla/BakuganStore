import { Router } from 'express';
import { pingDatabase, type Database } from '../../db/client';

/**
 * GET /api/health — để dịch vụ theo dõi (VD UptimeRobot) biết web còn sống.
 * CSDL không trả lời thì báo 503. Không trả thông tin nội bộ nào khác.
 */
export function healthRouter(database: Database): Router {
  const router = Router();
  const startedAt = Date.now();
  router.get('/', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!(await pingDatabase(database.pool))) {
      res.status(503).json({ message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
      return;
    }
    res.json({
      data: {
        status: 'ok',
        database: 'ok',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      },
    });
  });
  return router;
}

import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { orderIssues } from '../../db/schema';
import { parseInput } from '../../lib/errors';
import { requireAdmin } from '../../middleware/auth';
import {
  adminOrderQuerySchema,
  createIssue,
  createIssueSchema,
  createManualOrder,
  createOrderSchema,
  getAdminOrder,
  internalNoteSchema,
  listAdminOrders,
  listIssues,
  updateInternalNote,
  updateIssue,
  updateIssueSchema,
  updateOrderStatus,
  updatePaymentSchema,
  updatePaymentStatus,
  updateStatusSchema,
  type AdminOrderDeps,
} from './service';

/** /api/admin/orders — admin xử lý đơn (chỉ admin). */
export function adminOrdersRouter(deps: AdminOrderDeps): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/', async (req, res) => {
    res.json({
      data: await listAdminOrders(deps.db, parseInput(adminOrderQuerySchema, req.query)),
    });
  });

  router.post('/', async (req, res) => {
    const input = parseInput(createOrderSchema, req.body);
    res.status(201).json({ data: await createManualOrder(deps, req, input) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ data: await getAdminOrder(deps.db, req.params.id) });
  });

  router.get('/:id/issues', async (req, res) => {
    res.json({ data: await listIssues(deps.db, eq(orderIssues.orderId, req.params.id)) });
  });

  router.patch('/:id/status', async (req, res) => {
    const input = parseInput(updateStatusSchema, req.body);
    res.json({ data: await updateOrderStatus(deps, req, req.params.id, input) });
  });

  router.patch('/:id/payment', async (req, res) => {
    const { paymentStatus } = parseInput(updatePaymentSchema, req.body);
    res.json({ data: await updatePaymentStatus(deps, req, req.params.id, paymentStatus) });
  });

  router.patch('/:id', async (req, res) => {
    const note = parseInput(internalNoteSchema, req.body);
    res.json({ data: await updateInternalNote(deps, req, req.params.id, note) });
  });

  return router;
}

/** /api/admin/issues — sự cố đơn hàng (chỉ admin). */
export function adminIssuesRouter(deps: Pick<AdminOrderDeps, 'db'>): Router {
  const router = Router();
  router.use(requireAdmin);

  router.post('/', async (req, res) => {
    const input = parseInput(createIssueSchema, req.body);
    res.status(201).json({ data: await createIssue(deps.db, req, input) });
  });

  router.patch('/:id', async (req, res) => {
    const input = parseInput(updateIssueSchema, req.body);
    res.json({ data: await updateIssue(deps.db, req, req.params.id, input) });
  });

  return router;
}

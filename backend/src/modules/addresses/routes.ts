import { and, asc, count, eq, ne } from 'drizzle-orm';
import { Router } from 'express';
import type { Db } from '../../db/client';
import { addresses } from '../../db/schema';
import { withTransaction, type Tx } from '../../db/tx';
import { notFound, parseInput, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { currentUser, requireUser } from '../../middleware/auth';
import { addressSchema } from '../../shared/authSchemas';

const MAX_ADDRESSES = 10;

/** Luôn có đúng một địa chỉ mặc định (nếu sổ còn địa chỉ): thiếu thì địa chỉ cũ nhất làm mặc định. */
async function ensureOneDefault(tx: Tx, userId: string): Promise<void> {
  const rows = await tx
    .select({ id: addresses.id, isDefault: addresses.isDefault })
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(asc(addresses.createdAt), asc(addresses.id));
  if (rows.length > 0 && !rows.some((row) => row.isDefault)) {
    await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, rows[0]!.id));
  }
}

/** Bỏ mặc định ở các địa chỉ khác trước, rồi mới đặt địa chỉ này (UNIQUE chặn hai mặc định). */
async function makeDefault(tx: Tx, userId: string, addressId: string): Promise<void> {
  await tx
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.userId, userId), ne(addresses.id, addressId)));
  await tx
    .update(addresses)
    .set({ isDefault: true })
    .where(and(eq(addresses.userId, userId), eq(addresses.id, addressId)));
}

async function ownAddress(tx: Tx, userId: string, addressId: string) {
  const [row] = await tx
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
    .for('update');
  // Địa chỉ của người khác cũng trả 404, không lộ là có tồn tại.
  if (!row) throw notFound('Không tìm thấy địa chỉ này.');
  return row;
}

/** /api/addresses — sổ địa chỉ của chính người đang đăng nhập. */
export function addressesRouter(db: Db): Router {
  const router = Router();
  router.use(requireUser);

  router.post('/', async (req, res) => {
    const userId = currentUser(req).id;
    const input = parseInput(addressSchema, req.body);
    const id = newId();
    await withTransaction(db, async (tx) => {
      const [{ total } = { total: 0 }] = await tx
        .select({ total: count() })
        .from(addresses)
        .where(eq(addresses.userId, userId));
      if (total >= MAX_ADDRESSES) {
        throw unprocessable(`Sổ địa chỉ tối đa ${MAX_ADDRESSES} địa chỉ.`);
      }
      const { isDefault, ...fields } = input;
      await tx.insert(addresses).values({ id, userId, ...fields, isDefault: false });
      if (isDefault) await makeDefault(tx, userId, id);
      await ensureOneDefault(tx, userId);
    });
    res.status(201).json({ data: { id } });
  });

  router.put('/:id', async (req, res) => {
    const userId = currentUser(req).id;
    const input = parseInput(addressSchema, req.body);
    await withTransaction(db, async (tx) => {
      await ownAddress(tx, userId, req.params.id);
      const { isDefault, ...fields } = input;
      await tx.update(addresses).set(fields).where(eq(addresses.id, req.params.id));
      if (isDefault) await makeDefault(tx, userId, req.params.id);
      await ensureOneDefault(tx, userId);
    });
    res.json({ data: { id: req.params.id } });
  });

  router.patch('/:id/default', async (req, res) => {
    const userId = currentUser(req).id;
    await withTransaction(db, async (tx) => {
      await ownAddress(tx, userId, req.params.id);
      await makeDefault(tx, userId, req.params.id);
    });
    res.json({ data: { id: req.params.id } });
  });

  router.delete('/:id', async (req, res) => {
    const userId = currentUser(req).id;
    await withTransaction(db, async (tx) => {
      await ownAddress(tx, userId, req.params.id);
      await tx.delete(addresses).where(eq(addresses.id, req.params.id));
      await ensureOneDefault(tx, userId);
    });
    res.json({ data: { ok: true } });
  });

  return router;
}

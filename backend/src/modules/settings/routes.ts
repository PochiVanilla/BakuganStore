import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { settings } from '../../db/schema';
import { withTransaction } from '../../db/tx';
import { writeAudit } from '../../lib/audit';
import { parseInput, unprocessable } from '../../lib/errors';
import { currentUser, requireAdmin } from '../../middleware/auth';
import { INITIAL_BOT_SETTINGS } from '../../shared/defaults';
import { BOT_TOPIC_IDS, type BotSettings, type ShopSettings } from '../../shared/types';
import { readShopSettings } from './shop';

/*
 * /api/admin/settings — trang Cài đặt của admin (luật kiểm tra như bản giả lập,
 * src/services/api/admin/settings.ts). Mỗi lần lưu ghi nhật ký admin.
 */

const shopPatchSchema = z.object({
  memberDepositAmount: z.number().optional(),
  bank: z
    .object({
      bankName: z.string().max(100),
      accountNumber: z.string().max(40),
      accountHolder: z.string().max(100),
    })
    .optional(),
  cardPayments: z.boolean().optional(),
  international: z
    .object({
      enabled: z.boolean(),
      feeAsia: z.number(),
      feeWorld: z.number(),
      usdRate: z.number(),
    })
    .optional(),
});

function invalidSetting(message: string, field: string): never {
  throw unprocessable(message, { [field]: message });
}

/** Ghép phần admin vừa sửa vào cài đặt hiện có, kiểm tra từng ô như web. */
export function applyShopPatch(
  current: ShopSettings,
  patch: z.infer<typeof shopPatchSchema>,
): ShopSettings {
  const next = structuredClone(current);
  if (patch.memberDepositAmount !== undefined) {
    const amount = patch.memberDepositAmount;
    if (!Number.isInteger(amount) || amount < 0 || amount > 50_000_000) {
      invalidSetting('Số tiền nạp lên Lv2 phải từ 0 đến 50.000.000₫.', 'memberDepositAmount');
    }
    next.memberDepositAmount = amount;
  }
  if (patch.bank) {
    const accountNumber = patch.bank.accountNumber.replace(/\s+/g, '');
    if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
      invalidSetting('Số tài khoản chỉ gồm 6–20 chữ số.', 'accountNumber');
    }
    next.bank = {
      bankName: patch.bank.bankName.trim().slice(0, 60),
      accountNumber,
      accountHolder: patch.bank.accountHolder.trim().toUpperCase().slice(0, 60),
    };
  }
  if (patch.cardPayments !== undefined) next.cardPayments = patch.cardPayments;
  if (patch.international) {
    const { enabled, feeAsia, feeWorld, usdRate } = patch.international;
    const fee = (value: number, field: string): number => {
      if (!Number.isInteger(value) || value < 0 || value > 20_000_000) {
        invalidSetting('Phí gửi phải từ 0 đến 20.000.000₫.', field);
      }
      return value;
    };
    if (!Number.isInteger(usdRate) || usdRate < 1_000 || usdRate > 100_000) {
      invalidSetting('Tỉ giá phải từ 1.000 đến 100.000₫ cho 1 USD.', 'usdRate');
    }
    next.international = {
      enabled,
      feeAsia: fee(feeAsia, 'feeAsia'),
      feeWorld: fee(feeWorld, 'feeWorld'),
      usdRate,
    };
  }
  // Đơn quốc tế chỉ trả bằng thẻ: tắt thẻ thì cũng tắt nhận đơn quốc tế.
  if (!next.cardPayments) next.international = { ...next.international, enabled: false };
  return next;
}

/* ---------------- Bot ---------------- */

const topicsSchema = z.object(
  Object.fromEntries(BOT_TOPIC_IDS.map((id) => [id, z.boolean()])) as Record<
    (typeof BOT_TOPIC_IDS)[number],
    z.ZodBoolean
  >,
);

const botSettingsSchema = z.object({
  enabled: z.boolean(),
  greeting: z.string().trim().min(1, 'Nhập lời chào.').max(300, 'Lời chào tối đa 300 ký tự.'),
  topics: topicsSchema,
  extraKnowledge: z.string().trim().max(1_500, 'Ghi chú cho bot tối đa 1.500 ký tự.'),
  handoffMessage: z
    .string()
    .trim()
    .min(1, 'Nhập câu báo khi chuyển cho nhân viên.')
    .max(300, 'Câu báo tối đa 300 ký tự.'),
});

/** Cài đặt bot đang dùng (thiếu / hỏng thì dùng mặc định); `updatedAt` là lần lưu gần nhất. */
export async function readBotSettings(db: Db): Promise<BotSettings> {
  const [row] = await db
    .select({ value: settings.value, updatedAt: settings.updatedAt })
    .from(settings)
    .where(eq(settings.name, 'bot'))
    .limit(1);
  const parsed = botSettingsSchema.safeParse(row?.value ?? {});
  return {
    ...(parsed.success ? parsed.data : INITIAL_BOT_SETTINGS),
    updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
  };
}

export function adminSettingsRouter(db: Db): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/shop', async (_req, res) => {
    res.json({ data: await readShopSettings(db) });
  });

  router.patch('/shop', async (req, res) => {
    const patch = parseInput(shopPatchSchema, req.body);
    const saved = await withTransaction(db, async (tx) => {
      // Khoá dòng cài đặt: hai khung lưu cùng lúc không đè mất phần của nhau.
      await tx.select().from(settings).where(eq(settings.name, 'shop')).for('update');
      const next = applyShopPatch(await readShopSettings(tx), patch);
      await tx
        .insert(settings)
        .values({ name: 'shop', value: next, updatedBy: currentUser(req).id })
        .onDuplicateKeyUpdate({
          set: { value: next, updatedBy: currentUser(req).id, updatedAt: new Date() },
        });
      await writeAudit(tx, req, {
        action: 'settings.shop',
        targetType: 'settings',
        targetId: 'shop',
        // Không ghi số tài khoản vào nhật ký.
        detail: { changed: Object.keys(patch) },
      });
      return next;
    });
    res.json({ data: saved });
  });

  router.get('/bot', async (_req, res) => {
    res.json({ data: await readBotSettings(db) });
  });

  router.put('/bot', async (req, res) => {
    const input = parseInput(botSettingsSchema, req.body);
    await withTransaction(db, async (tx) => {
      await tx
        .insert(settings)
        .values({ name: 'bot', value: input, updatedBy: currentUser(req).id })
        .onDuplicateKeyUpdate({
          set: { value: input, updatedBy: currentUser(req).id, updatedAt: new Date() },
        });
      await writeAudit(tx, req, {
        action: 'settings.bot',
        targetType: 'settings',
        targetId: 'bot',
        detail: { enabled: input.enabled },
      });
    });
    res.json({ data: await readBotSettings(db) });
  });

  return router;
}

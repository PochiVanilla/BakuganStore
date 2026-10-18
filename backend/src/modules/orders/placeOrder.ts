import { createHash, randomInt } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import {
  cardPayments,
  couponRedemptions,
  coupons,
  feeds,
  idempotencyKeys,
  items,
  orderItems,
  orders,
} from '../../db/schema';
import { duplicateKeyName, withTransaction, type Tx } from '../../db/tx';
import { conflict, unprocessable } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { AuthUser } from '../../middleware/auth';
import {
  CARD_HOLD_MINUTES,
  cleanIntlAddress,
  compactPhone,
  formatIntlAddress,
  isValidPhone,
  isVietnamPhone,
  validateIntlAddress,
} from '../../shared/orders';
import { calculateTotals, couponAppliesTo, type ShippingDestination } from '../../shared/pricing';
import {
  PAYMENT_METHODS,
  type InternationalAddress,
  type ShippingRegion,
} from '../../shared/types';
import type { FeedCatalog } from '../catalog/store';
import { checkoutConfigOf, readShopSettings } from '../settings/shop';
import { checkCoupon, toCoupon } from './coupons';
import { addEvent, customerActor, expireCardHolds, sellItems } from './mutations';

/*
 * POST /api/orders — khách chốt đơn. Phần quan trọng nhất: không bao giờ bán một con cho hai người.
 *
 * 1. Kiểm tra dữ liệu (trong nước / quốc tế) với đúng câu báo lỗi của web.
 * 2. Idempotency-Key đã gặp → trả lại đúng đơn lần trước (bấm hai lần không ra hai đơn).
 * 3. Transaction: khoá từng con theo thứ tự id (SELECT … FOR UPDATE) → ai đặt trùng con phải chờ;
 *    khi tới lượt, đọc lại thấy con đã SOLD thì báo 409. Giá lấy từ CSDL, không lấy từ trình duyệt.
 * 4. Ghi đơn, dòng hàng (chụp lại tên, mã, giá, ảnh), lịch sử, giữ hàng 15 phút nếu trả thẻ,
 *    chuyển các con sang SOLD, ghi lượt mã giảm giá — tất cả cùng một transaction.
 */

const intlAddressSchema = z.object({
  countryCode: z.string().max(2),
  line1: z.string().max(200),
  line2: z.string().max(200).optional(),
  city: z.string().max(100),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

export const checkoutSchema = z.object({
  itemIds: z.array(z.string().max(36)).max(200),
  receiverName: z.string().max(200),
  phone: z.string().max(40),
  addressLine: z.string().max(1_000).default(''),
  shippingRegion: z.enum(['domestic', 'international']).optional(),
  intlAddress: intlAddressSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: z.string().max(60).optional(),
  note: z.string().max(2_000).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const MAX_ITEMS_PER_ORDER = 60;

export interface PlaceOrderDeps {
  db: Db;
  catalog: FeedCatalog;
  logger: Logger;
  cardGatewayReady: boolean;
}

function invalid(message: string): never {
  throw unprocessable(message);
}

/** Mã đơn TD + ngày + tháng (giờ Việt Nam) + 1 chữ + 2 số, VD TD1810K42. */
export function randomOrderCode(at: Date): string {
  const [, month, day] = at
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    .split('-');
  const letter = String.fromCharCode(65 + randomInt(26));
  return `TD${day}${month}${letter}${randomInt(10, 100)}`;
}

/** Sinh mã đơn chưa ai dùng (UNIQUE trên cột là chốt chặn cuối). */
export async function newOrderCode(tx: Tx, at: Date): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const code = randomOrderCode(at);
    const [taken] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.code, code))
      .limit(1);
    if (!taken) return code;
  }
  return `TD${Date.now().toString(36).toUpperCase()}`;
}

interface CleanCheckout {
  ids: string[];
  region: ShippingRegion;
  receiverName: string;
  phone: string;
  addressLine: string;
  intlAddress: InternationalAddress | null;
  destination: ShippingDestination;
}

function cleanCheckout(input: CheckoutInput, cardAllowed: boolean, intlAllowed: boolean) {
  const ids = [...new Set(input.itemIds)];
  if (ids.length === 0) invalid('Giỏ hàng đang trống.');
  if (ids.length > MAX_ITEMS_PER_ORDER) invalid(`Mỗi đơn tối đa ${MAX_ITEMS_PER_ORDER} con.`);
  const region: ShippingRegion = input.shippingRegion ?? 'domestic';
  const receiverName = input.receiverName.trim();
  const phone = input.phone.trim();
  if (receiverName.length < 2) invalid('Nhập họ tên người nhận.');
  if (receiverName.length > 100) invalid('Họ tên người nhận tối đa 100 ký tự.');
  if (input.paymentMethod === 'card' && !cardAllowed) {
    invalid('Shop đang tạm ngưng nhận thanh toán thẻ — bạn chọn cách khác nhé.');
  }

  let addressLine: string;
  let intlAddress: InternationalAddress | null = null;
  if (region === 'international') {
    if (!intlAllowed) invalid('Shop đang tạm ngưng gửi hàng ra nước ngoài.');
    if (input.paymentMethod !== 'card') {
      invalid('Đơn gửi ra nước ngoài chỉ thanh toán bằng thẻ Visa / Mastercard / JCB.');
    }
    if (!compactPhone(phone).startsWith('+') || !isValidPhone(phone)) {
      invalid('Ghi số điện thoại kèm mã nước (VD +1 415 555 0123) để bưu điện nước ngoài liên hệ.');
    }
    const problems = validateIntlAddress(
      input.intlAddress ?? { countryCode: '', line1: '', city: '' },
    );
    const firstProblem = Object.values(problems)[0];
    if (firstProblem) invalid(firstProblem);
    intlAddress = cleanIntlAddress(input.intlAddress!);
    addressLine = formatIntlAddress(intlAddress);
  } else {
    if (!isVietnamPhone(phone)) invalid('Số điện thoại người nhận chưa đúng (VD 0912345678).');
    addressLine = input.addressLine.trim();
    if (addressLine.length < 10)
      invalid('Ghi rõ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành.');
    if (addressLine.length > 500) invalid('Địa chỉ tối đa 500 ký tự.');
  }
  return {
    ids,
    region,
    receiverName,
    phone,
    addressLine,
    intlAddress,
    destination: { region, countryCode: intlAddress?.countryCode },
  } satisfies CleanCheckout;
}

const ROUTE = 'POST /orders';

function requestHashOf(input: CheckoutInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/** Lần bấm này đã tạo đơn rồi thì trả lại đơn đó; Idempotency-Key dùng cho yêu cầu khác → 422. */
async function replay(db: Db, userId: string, key: string, hash: string) {
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idemKey, key)))
    .limit(1);
  if (!row) return undefined;
  if (row.requestHash !== hash || row.route !== ROUTE) {
    invalid('Mã chống gửi trùng (Idempotency-Key) đã dùng cho một yêu cầu khác.');
  }
  const orderId = (row.response as { orderId?: unknown } | null)?.orderId;
  if (typeof orderId !== 'string')
    throw conflict('Đơn đang được xử lý, bạn chờ chút rồi tải lại trang.');
  return orderId;
}

export async function placeOrder(
  deps: PlaceOrderDeps,
  user: AuthUser,
  input: CheckoutInput,
  idemKey?: string,
): Promise<{ orderId: string; replayed: boolean }> {
  // Đơn trả thẻ quá hạn thì huỷ trước, để những con đang bị giữ được bán lại.
  await expireCardHolds(deps);
  const config = checkoutConfigOf(await readShopSettings(deps.db), deps.cardGatewayReady);
  const clean = cleanCheckout(input, config.cardPayments, config.international.enabled);
  const hash = requestHashOf(input);

  if (idemKey) {
    const previous = await replay(deps.db, user.id, idemKey, hash);
    if (previous) return { orderId: previous, replayed: true };
  }

  const orderId = newId();
  try {
    await withTransaction(deps.db, async (tx) => {
      // Ghi mã chống gửi trùng đầu tiên: lần gửi trùng chạy song song phải chờ ở đây.
      if (idemKey) {
        await tx.insert(idempotencyKeys).values({
          id: newId(),
          userId: user.id,
          idemKey,
          route: ROUTE,
          requestHash: hash,
          responseStatus: 201,
          response: { orderId },
        });
      }

      // Khoá đúng những con này, theo thứ tự id để hai đơn tranh nhau khó kẹt nhau.
      const locked = await tx
        .select()
        .from(items)
        .where(inArray(items.id, clean.ids))
        .orderBy(asc(items.id))
        .for('update');
      const byId = new Map(locked.map((item) => [item.id, item]));
      const feedIds = [...new Set(locked.flatMap((item) => (item.feedId ? [item.feedId] : [])))];
      const feedRows =
        feedIds.length > 0 ? await tx.select().from(feeds).where(inArray(feeds.id, feedIds)) : [];
      const feedById = new Map(feedRows.map((feed) => [feed.id, feed]));

      const lines = clean.ids.map((id) => {
        const item = byId.get(id);
        const feed = item?.feedId ? feedById.get(item.feedId) : undefined;
        return { id, item, feed: feed && !feed.retiredAt ? feed : undefined };
      });
      const gone = lines.filter(({ item, feed }) => !item || !feed || item.status !== 'available');
      if (gone.length > 0) {
        const codes = gone.map(({ item }) => item?.code ?? 'một con').join(', ');
        throw conflict(
          `${codes} vừa có người chốt trước hoặc không còn trên feed. Bạn bỏ khỏi giỏ rồi đặt lại nhé.`,
        );
      }
      const now = new Date();
      const notOpen = lines.find(({ feed }) => feed!.opensAt.getTime() > now.getTime());
      if (notOpen) {
        throw conflict(
          `Feed #${notOpen.feed!.number} chưa tới giờ mở bán, bạn quay lại đúng giờ để chốt nhé.`,
        );
      }

      const priced = lines.map(({ item }) => ({ price: item!.price }));
      const subtotal = priced.reduce((sum, line) => sum + line.price, 0);
      const couponRow = input.couponCode?.trim()
        ? await checkCoupon(tx, input.couponCode, subtotal, { userId: user.id, lock: true })
        : null;
      const coupon = couponRow ? toCoupon(couponRow) : null;
      if (coupon && !couponAppliesTo(coupon, clean.destination)) {
        invalid(
          `Mã ${coupon.code} chỉ áp dụng cho đơn giao trong Việt Nam — gỡ mã rồi đặt lại nhé.`,
        );
      }
      const totals = calculateTotals(priced, coupon, clean.destination, config);
      const byCard = input.paymentMethod === 'card';

      await tx.insert(orders).values({
        id: orderId,
        code: await newOrderCode(tx, now),
        userId: user.id,
        customerEmail: user.email,
        source: 'web',
        status: 'pending',
        paymentMethod: input.paymentMethod,
        paymentStatus: 'unpaid',
        ...totals,
        couponCode: coupon?.code ?? null,
        receiverName: clean.receiverName,
        phone: clean.phone,
        addressLine: clean.addressLine,
        shippingRegion: clean.region,
        intlAddress: clean.intlAddress,
        note: input.note?.trim().slice(0, 500) || null,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(orderItems).values(
        lines.map(({ item }, index) => ({
          id: newId(),
          orderId,
          itemId: item!.id,
          code: item!.code,
          name: item!.name,
          price: item!.price,
          image: item!.photos[0] ?? '',
          position: index + 1,
        })),
      );
      const placedNote = [
        clean.region === 'international'
          ? 'Khách đặt trên web, gửi ra nước ngoài.'
          : 'Khách đặt trên web.',
        coupon && `Dùng mã ${coupon.code}.`,
        byCard && `Trả bằng thẻ — giữ hàng ${CARD_HOLD_MINUTES} phút chờ thanh toán.`,
      ]
        .filter(Boolean)
        .join(' ');
      await addEvent(tx, orderId, 'pending', customerActor(user.id), placedNote, now);
      if (byCard) {
        await tx.insert(cardPayments).values({
          orderId,
          expiresAt: new Date(now.getTime() + CARD_HOLD_MINUTES * 60_000),
          attempts: 0,
        });
      }
      await sellItems(tx, orderId, clean.ids, now);
      if (coupon) {
        await tx.insert(couponRedemptions).values({
          id: newId(),
          couponCode: coupon.code,
          orderId,
          userId: user.id,
        });
        await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(eq(coupons.code, coupon.code));
      }
    });
  } catch (error) {
    // Lần gửi trùng chạy song song: lần kia đã tạo đơn → trả lại đơn đó.
    if (idemKey && duplicateKeyName(error) === 'idempotency_keys_user_key_uq') {
      const previous = await replay(deps.db, user.id, idemKey, hash);
      if (previous) return { orderId: previous, replayed: true };
    }
    throw error;
  }
  deps.catalog.invalidate();
  return { orderId, replayed: false };
}

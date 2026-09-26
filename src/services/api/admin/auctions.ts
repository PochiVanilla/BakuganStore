import type { AdminAuctionRow, ApiResponse } from '@/types';
import { readDb, updateDb } from '@/mocks/db';
import { listAuctionsSnapshot } from '../auctionService';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';

/**
 * Các phiên đấu giá kèm khâu sau phiên. Admin xem được cả giá của phiên kín
 * và danh tính người thắng để liên hệ tạo đơn.
 */
export async function listAdminAuctions(): Promise<AdminAuctionRow[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<AdminAuctionRow[]>>('/admin/auctions');
    return data.data;
  }
  requireAdmin();
  const db = readDb();

  const rows = listAuctionsSnapshot().map((auction): AdminAuctionRow => {
    const top = auction.bids[0];
    const winnerRecord = top ? db.users.find((user) => user.id === top.bidderId) : undefined;
    const winner =
      auction.status === 'ended' && top
        ? {
            id: top.bidderId,
            fullName: winnerRecord?.fullName ?? top.bidderMaskedName,
            email: winnerRecord?.email ?? '',
            phone: winnerRecord?.phone ?? '',
            amount: top.amount,
          }
        : undefined;

    const record = db.auctionFulfillments.find((item) => item.auctionId === auction.id);
    const order = record?.orderId
      ? db.orders.find((item) => item.id === record.orderId)
      : undefined;

    let fulfillment: AdminAuctionRow['fulfillment'] = 'running';
    if (auction.status === 'ended') {
      if (auction.bids.length === 0) fulfillment = 'no-winner';
      else fulfillment = record?.status ?? 'awaiting-order';
    }

    return {
      auction,
      fulfillment,
      winner,
      orderId: order?.id,
      orderCode: order?.code,
      note: record?.note,
    };
  });

  const weight: Record<AdminAuctionRow['fulfillment'], number> = {
    'awaiting-order': 0,
    running: 1,
    'order-created': 2,
    forfeited: 3,
    'no-winner': 4,
  };
  return mockDelay(
    rows.sort(
      (a, b) =>
        weight[a.fulfillment] - weight[b.fulfillment] ||
        a.auction.endAt.localeCompare(b.auction.endAt),
    ),
    280,
  );
}

/** Người thắng không thanh toán / bỏ cọc — đóng phiên, không tạo đơn. */
export async function markAuctionForfeited(auctionId: string, note: string): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.post(`/admin/auctions/${auctionId}/forfeit`, { note });
    return;
  }
  requireAdmin();
  const auction = listAuctionsSnapshot().find((item) => item.id === auctionId);
  if (!auction || auction.status !== 'ended') {
    throw new MockApiError('Chỉ đóng được phiên đã kết thúc.', 409);
  }
  updateDb((db) => {
    db.auctionFulfillments = db.auctionFulfillments.filter((item) => item.auctionId !== auctionId);
    db.auctionFulfillments.push({
      auctionId,
      status: 'forfeited',
      note: note.trim() || 'Người thắng không hoàn tất thanh toán.',
      updatedAt: new Date().toISOString(),
    });
  });
  await mockDelay(null, 350);
}

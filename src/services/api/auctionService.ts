import type { ApiResponse, Auction, AuctionStatus, Bid } from '@/types';
import { MOCK_AUCTIONS } from '@/mocks';
import { maskName } from '@/utils/format';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';

/** Bản sao trong bộ nhớ để mock "đặt giá" có hiệu lực trong phiên làm việc. */
const auctionStore: Auction[] = MOCK_AUCTIONS.map((auction) => ({
  ...auction,
  bids: [...auction.bids],
}));

function refreshStatus(auction: Auction, now = Date.now()): Auction {
  const startAt = new Date(auction.startAt).getTime();
  const endAt = new Date(auction.endAt).getTime();
  let status: AuctionStatus = 'live';
  if (now < startAt) status = 'upcoming';
  else if (now > endAt) status = 'ended';
  return { ...auction, status };
}

export async function fetchAuctions(status?: AuctionStatus): Promise<Auction[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Auction[]>>('/auctions', {
      params: { status },
    });
    return data.data;
  }
  const now = Date.now();
  const items = auctionStore.map((auction) => refreshStatus(auction, now));
  return mockDelay(status ? items.filter((auction) => auction.status === status) : items, 280);
}

export async function fetchAuctionById(id: string): Promise<Auction> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Auction>>(`/auctions/${id}`);
    return data.data;
  }
  const auction = auctionStore.find((item) => item.id === id);
  if (!auction) throw new MockApiError('Không tìm thấy phiên đấu giá này.', 404);
  return mockDelay(refreshStatus(auction), 260);
}

export interface PlaceBidPayload {
  auctionId: string;
  amount: number;
  bidderId: string;
  bidderName: string;
}

export async function placeBid(payload: PlaceBidPayload): Promise<Auction> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Auction>>(
      `/auctions/${payload.auctionId}/bids`,
      { amount: payload.amount },
    );
    return data.data;
  }

  const index = auctionStore.findIndex((item) => item.id === payload.auctionId);
  if (index === -1) throw new MockApiError('Không tìm thấy phiên đấu giá này.', 404);

  const auction = refreshStatus(auctionStore[index]!);
  if (auction.status === 'upcoming') {
    throw new MockApiError('Phiên đấu giá chưa bắt đầu.', 409);
  }
  if (auction.status === 'ended') {
    throw new MockApiError('Phiên đấu giá đã kết thúc.', 409);
  }

  const minimum = auction.currentPrice + auction.bidStep;
  if (payload.amount < minimum) {
    throw new MockApiError(`Giá đặt phải từ ${minimum.toLocaleString('vi-VN')}₫ trở lên.`, 422, {
      amount: `Giá đặt tối thiểu là ${minimum.toLocaleString('vi-VN')}₫.`,
    });
  }

  const bid: Bid = {
    id: `bid-${auction.id}-${Date.now()}`,
    auctionId: auction.id,
    bidderId: payload.bidderId,
    bidderMaskedName: maskName(payload.bidderName),
    amount: payload.amount,
    createdAt: new Date().toISOString(),
  };

  const updated: Auction = {
    ...auction,
    currentPrice: payload.amount,
    bidCount: auction.bidCount + 1,
    bids: [bid, ...auction.bids],
  };
  auctionStore[index] = updated;

  return mockDelay(updated, 420);
}

/** Lịch sử đấu giá của một người dùng (tab "Lịch sử đấu giá"). */
export interface UserBidRecord {
  auction: Auction;
  myHighestBid: number;
  isWinning: boolean;
}

export async function fetchMyBids(userId: string): Promise<UserBidRecord[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<UserBidRecord[]>>('/auctions/my-bids');
    return data.data;
  }
  const now = Date.now();
  const records = auctionStore
    .map((auction) => refreshStatus(auction, now))
    .map((auction) => {
      const mine = auction.bids.filter((bid) => bid.bidderId === userId);
      if (mine.length === 0) return null;
      const myHighestBid = Math.max(...mine.map((bid) => bid.amount));
      return {
        auction,
        myHighestBid,
        isWinning: auction.bids[0]?.bidderId === userId,
      } satisfies UserBidRecord;
    })
    .filter((record): record is UserBidRecord => record !== null);

  return mockDelay(records, 260);
}

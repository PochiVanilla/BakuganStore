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

/** Ảnh chụp tức thời các phiên (chỉ dùng trong tầng mock, VD: trang quản trị). */
export function listAuctionsSnapshot(now: number = Date.now()): Auction[] {
  return auctionStore.map((auction) => refreshStatus(auction, now));
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

  const minimum = getMinimumBid(auction, payload.bidderId);
  if (payload.amount < minimum) {
    throw new MockApiError(`Giá đặt phải từ ${minimum.toLocaleString('vi-VN')}₫ trở lên.`, 422, {
      amount: `Giá đặt tối thiểu là ${minimum.toLocaleString('vi-VN')}₫.`,
    });
  }

  // Phiên kín: không lộ giá dẫn đầu, nhưng lượt thấp hơn vẫn bị loại.
  if (auction.priceVisibility === 'sealed' && payload.amount <= auction.currentPrice) {
    throw new MockApiError(
      'Lượt đặt chưa vượt được người đang dẫn đầu. Hãy thử một mức cao hơn.',
      422,
      { amount: 'Mức này chưa đủ để vượt lên dẫn đầu.' },
    );
  }

  /* ---- Luật chống bắn tỉa ----
     Lượt đặt rơi vào những phút cuối sẽ đẩy giờ kết thúc ra thêm đúng ngần
     đó phút, nên không ai giành được phiên bằng cách bấm ở giây chót. */
  const now = Date.now();
  const endAtMs = new Date(auction.endAt).getTime();
  const windowMs = auction.antiSnipeMinutes * 60_000;
  const withinSnipeWindow = auction.antiSnipeMinutes > 0 && endAtMs - now <= windowMs;

  const bid: Bid = {
    id: `bid-${auction.id}-${Date.now()}`,
    auctionId: auction.id,
    bidderId: payload.bidderId,
    bidderMaskedName: maskName(payload.bidderName),
    amount: payload.amount,
    createdAt: new Date().toISOString(),
    triggeredExtension: withinSnipeWindow,
  };

  const updated: Auction = {
    ...auction,
    currentPrice: payload.amount,
    bidCount: auction.bidCount + 1,
    bids: [bid, ...auction.bids],
    endAt: withinSnipeWindow ? new Date(now + windowMs).toISOString() : auction.endAt,
    extensionCount: auction.extensionCount + (withinSnipeWindow ? 1 : 0),
  };
  auctionStore[index] = updated;

  return mockDelay(updated, 420);
}

/**
 * Mức giá tối thiểu cho lượt đặt kế tiếp.
 *
 * - Phiên mở: giá hiện tại cộng bước giá, ai cũng tính được.
 * - Phiên kín: người đặt không được biết giá hiện tại, nên mốc tối thiểu chỉ
 *   dựa trên giá khởi điểm và lượt cao nhất của chính người đó. Hệ thống vẫn
 *   âm thầm loại lượt nào chưa vượt người dẫn đầu.
 */
export function getMinimumBid(auction: Auction, bidderId?: string): number {
  if (auction.priceVisibility === 'open') {
    return auction.currentPrice + auction.bidStep;
  }
  const myHighest = bidderId
    ? Math.max(
        0,
        ...auction.bids.filter((bid) => bid.bidderId === bidderId).map((bid) => bid.amount),
      )
    : 0;
  return Math.max(auction.startPrice, myHighest + auction.bidStep);
}

/** Phiên có đang nằm trong khung giờ chống bắn tỉa không. */
export function isInAntiSnipeWindow(auction: Auction, now: number = Date.now()): boolean {
  if (auction.antiSnipeMinutes <= 0 || auction.status !== 'live') return false;
  return new Date(auction.endAt).getTime() - now <= auction.antiSnipeMinutes * 60_000;
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

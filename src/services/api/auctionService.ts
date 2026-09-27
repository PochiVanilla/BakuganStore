import type { ApiResponse, Auction, AuctionRecord, AuctionStatus, Bid } from '@/types';
import { AUCTION_MIN_LEVEL } from '@/constants/catalog';
import { MOCK_AUCTIONS } from '@/mocks';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';
import { currentMockUser, requireUser } from './mockSession';
import { levelOf } from './membershipRules';

/* ============================================================
   Sàn đấu giá.

   Không công khai người đặt giá: khách chỉ thấy giá cao nhất, số
   lượt và số người đã đặt (hình cây búa), cộng với các lượt của
   chính mình. Tên người đặt chỉ có ở trang quản trị.
   Chỉ thành viên Lv2 trở lên mới được đặt giá.
   ============================================================ */

/** Bản sao trong bộ nhớ để mock "đặt giá" có hiệu lực trong phiên làm việc. */
const auctionStore: AuctionRecord[] = MOCK_AUCTIONS.map((auction) => ({
  ...auction,
  bids: [...auction.bids],
}));

function refreshStatus(auction: AuctionRecord, now = Date.now()): AuctionRecord {
  const startAt = new Date(auction.startAt).getTime();
  const endAt = new Date(auction.endAt).getTime();
  let status: AuctionStatus = 'live';
  if (now < startAt) status = 'upcoming';
  else if (now > endAt) status = 'ended';
  return { ...auction, status };
}

/** Bản đầy đủ các phiên (có tên người đặt) — chỉ dùng trong tầng mock cho trang quản trị. */
export function listAuctionsSnapshot(now: number = Date.now()): AuctionRecord[] {
  return auctionStore.map((auction) => refreshStatus(auction, now));
}

/** Bỏ danh tính người đặt, chỉ giữ lại lượt của chính người đang xem. */
export function toPublicAuction(record: AuctionRecord, viewerId?: string): Auction {
  const { bids, ...rest } = record;
  return {
    ...rest,
    bidderCount: new Set(bids.map((bid) => bid.bidderId)).size,
    myBids: viewerId
      ? bids
          .filter((bid) => bid.bidderId === viewerId)
          .map(({ amount, createdAt, triggeredExtension }) => ({
            amount,
            createdAt,
            triggeredExtension,
          }))
      : [],
    viewerIsLeading: Boolean(viewerId) && bids[0]?.bidderId === viewerId,
  };
}

export async function fetchAuctions(status?: AuctionStatus): Promise<Auction[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Auction[]>>('/auctions', {
      params: { status },
    });
    return data.data;
  }
  const viewerId = currentMockUser()?.id;
  const items = listAuctionsSnapshot().map((auction) => toPublicAuction(auction, viewerId));
  return mockDelay(status ? items.filter((auction) => auction.status === status) : items, 280);
}

export async function fetchAuctionById(id: string): Promise<Auction> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Auction>>(`/auctions/${id}`);
    return data.data;
  }
  const auction = auctionStore.find((item) => item.id === id);
  if (!auction) throw new MockApiError('Không tìm thấy phiên đấu giá này.', 404);
  return mockDelay(toPublicAuction(refreshStatus(auction), currentMockUser()?.id), 260);
}

export interface PlaceBidPayload {
  auctionId: string;
  amount: number;
}

export async function placeBid(payload: PlaceBidPayload): Promise<Auction> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Auction>>(
      `/auctions/${payload.auctionId}/bids`,
      { amount: payload.amount },
    );
    return data.data;
  }

  // Server tự biết ai đang đặt từ token, không tin id/tên do trình duyệt gửi lên.
  const bidder = requireUser();
  if (bidder.role !== 'customer') {
    throw new MockApiError('Tài khoản quản trị không tham gia đặt giá.', 403);
  }
  if (levelOf(bidder) < AUCTION_MIN_LEVEL) {
    throw new MockApiError(
      `Chỉ thành viên Lv${AUCTION_MIN_LEVEL} trở lên mới được đặt giá. Vào Tài khoản → Hạng thành viên để xem cách lên Lv${AUCTION_MIN_LEVEL}.`,
      403,
    );
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

  const minimum = minimumBidFor(auction, bidder.id);
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
    id: `bid-${auction.id}-${now}`,
    auctionId: auction.id,
    bidderId: bidder.id,
    bidderName: bidder.fullName,
    amount: payload.amount,
    createdAt: new Date(now).toISOString(),
    triggeredExtension: withinSnipeWindow,
  };

  const updated: AuctionRecord = {
    ...auction,
    currentPrice: payload.amount,
    bidCount: auction.bidCount + 1,
    bids: [bid, ...auction.bids],
    endAt: withinSnipeWindow ? new Date(now + windowMs).toISOString() : auction.endAt,
    extensionCount: auction.extensionCount + (withinSnipeWindow ? 1 : 0),
  };
  auctionStore[index] = updated;

  return mockDelay(toPublicAuction(updated, bidder.id), 420);
}

function minimumBidFor(auction: AuctionRecord, bidderId: string): number {
  return getMinimumBid(toPublicAuction(auction, bidderId));
}

/**
 * Mức giá tối thiểu cho lượt đặt kế tiếp.
 *
 * - Phiên mở: giá cao nhất hiện tại cộng bước giá, ai cũng tính được.
 * - Phiên kín: người đặt không được biết giá hiện tại, nên mốc tối thiểu chỉ
 *   dựa trên giá khởi điểm và lượt cao nhất của chính người đó. Hệ thống vẫn
 *   âm thầm loại lượt nào chưa vượt người dẫn đầu.
 */
export function getMinimumBid(auction: Auction): number {
  if (auction.priceVisibility === 'open') {
    return auction.currentPrice + auction.bidStep;
  }
  const myHighest = Math.max(0, ...auction.myBids.map((bid) => bid.amount));
  return Math.max(auction.startPrice, myHighest + auction.bidStep);
}

/** Phiên có đang nằm trong khung giờ chống bắn tỉa không. */
export function isInAntiSnipeWindow(
  auction: Pick<Auction, 'antiSnipeMinutes' | 'status' | 'endAt'>,
  now: number = Date.now(),
): boolean {
  if (auction.antiSnipeMinutes <= 0 || auction.status !== 'live') return false;
  return new Date(auction.endAt).getTime() - now <= auction.antiSnipeMinutes * 60_000;
}

/** Lịch sử đấu giá của người đang đăng nhập (tab "Lịch sử đấu giá"). */
export interface UserBidRecord {
  auction: Auction;
  myHighestBid: number;
  isWinning: boolean;
}

export async function fetchMyBids(): Promise<UserBidRecord[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<UserBidRecord[]>>('/auctions/my-bids');
    return data.data;
  }
  const user = requireUser();
  const records = listAuctionsSnapshot()
    .map((auction) => toPublicAuction(auction, user.id))
    .filter((auction) => auction.myBids.length > 0)
    .map((auction): UserBidRecord => ({
      auction,
      myHighestBid: Math.max(...auction.myBids.map((bid) => bid.amount)),
      isWinning: auction.viewerIsLeading,
    }));
  return mockDelay(records, 260);
}

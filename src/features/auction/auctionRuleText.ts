import type { Auction } from '@/types';
import { formatCurrency } from '@/utils/format';
import { EyeOff, Gavel, LockKeyhole, ShieldCheck, Timer, Wallet } from 'lucide-react';

interface RuleItem {
  icon: typeof Timer;
  title: string;
  text: string;
}

export function buildAuctionRules(auction?: Auction): RuleItem[] {
  const antiSnipe = auction?.antiSnipeMinutes ?? 5;

  return [
    {
      icon: Timer,
      title: `Chống bắn tỉa — tự gia hạn ${antiSnipe} phút`,
      text: `Mỗi lượt đặt trong ${antiSnipe} phút cuối sẽ đẩy giờ kết thúc ra thêm ${antiSnipe} phút. Phiên chỉ đóng khi trọn ${antiSnipe} phút trôi qua mà không ai đặt thêm, nên không ai thắng được nhờ bấm vào giây chót.`,
    },
    {
      icon: EyeOff,
      title: 'Phiên kín — không ai biết giá của người khác',
      text: 'Ở phiên kín, giá hiện tại và số tiền trong lịch sử đều được giấu. Bạn chỉ biết mình đang dẫn đầu hay đã bị vượt, nên phải trả đúng mức mình thấy xứng đáng thay vì canh hơn người khác một bước giá.',
    },
    {
      icon: LockKeyhole,
      title: 'Chỉ tài khoản đã đăng nhập được đặt giá',
      text: 'Mỗi lượt đặt đều gắn với một tài khoản và được ghi lại vĩnh viễn. Tên người đặt luôn hiển thị dạng ẩn một phần để bảo vệ quyền riêng tư.',
    },
    {
      icon: Gavel,
      title: 'Lượt đặt là cam kết mua',
      text: 'Đã đặt giá thì không thể huỷ. Hãy cân nhắc kỹ và tự đặt cho mình một mức trần trước khi vào phiên.',
    },
    {
      icon: Wallet,
      title: 'Thanh toán trong 48 giờ',
      text: 'Người thắng phiên được shop liên hệ trong 24 giờ và cần hoàn tất thanh toán trong 48 giờ. Quá hạn sẽ mất lượt và có thể bị hạn chế tham gia các phiên sau.',
    },
    {
      icon: ShieldCheck,
      title: 'Hàng đúng mô tả, đóng gói chống sốc',
      text: 'Mọi món lên sàn đều được kiểm tra cơ cấu bung nở và chụp ảnh thật trước khi mở phiên. Shop quay video khi đóng gói cho toàn bộ đơn đấu giá.',
    },
  ];
}

/** Mô tả ngắn để nhắc lại mốc giá tối thiểu tuỳ theo loại phiên. */
export function minimumBidHint(auction: Auction, minimum: number): string {
  if (auction.priceVisibility === 'sealed') {
    return `Phiên kín nên bạn không thấy giá của người khác. Mức tối thiểu của bạn là ${formatCurrency(minimum)}.`;
  }
  return `Tối thiểu ${formatCurrency(minimum)} (giá hiện tại cộng bước giá ${formatCurrency(auction.bidStep)}).`;
}

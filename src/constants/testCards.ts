import type { CardBrand } from '@/types';

/*
 * Thẻ thử của cổng thanh toán GIẢ LẬP. Web (trang cổng giả lập) và backend (cổng giả lập
 * chạy trên server) cùng dùng file này. Số khác đều bị từ chối, để không ai lỡ nhập thẻ thật.
 */

export type MockCardOutcome = 'success' | 'otp' | 'declined' | 'insufficient';

export const MOCK_TEST_CARDS: ReadonlyArray<{
  number: string;
  brand: CardBrand;
  outcome: MockCardOutcome;
  note: string;
}> = [
  { number: '4242 4242 4242 4242', brand: 'visa', outcome: 'success', note: 'Thành công' },
  {
    number: '4000 0000 0000 3220',
    brand: 'visa',
    outcome: 'otp',
    note: 'Cần xác thực 3-D Secure (OTP 123456)',
  },
  { number: '5555 5555 5555 4444', brand: 'mastercard', outcome: 'success', note: 'Thành công' },
  { number: '3530 1113 3330 0000', brand: 'jcb', outcome: 'success', note: 'Thành công' },
  { number: '4000 0000 0000 0002', brand: 'visa', outcome: 'declined', note: 'Bị từ chối' },
  { number: '4000 0000 0000 9995', brand: 'visa', outcome: 'insufficient', note: 'Không đủ số dư' },
];

export const MOCK_OTP = '123456';

export const MOCK_FAILURE_MESSAGES: Record<Exclude<MockCardOutcome, 'success' | 'otp'>, string> = {
  declined: 'Ngân hàng phát hành thẻ đã từ chối giao dịch. Thử thẻ khác hoặc liên hệ ngân hàng.',
  insufficient: 'Thẻ không đủ số dư / hạn mức cho giao dịch này.',
};

export const MOCK_OTP_FAILED = 'Xác thực 3-D Secure không thành công (sai mã OTP).';

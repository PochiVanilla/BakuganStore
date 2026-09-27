import { domAnimation } from 'framer-motion';

/*
 * Phần tính toán hiệu ứng của framer-motion — tải riêng sau khi trang đã hiện
 * (xem MotionProvider), để lần tải đầu không phải chờ cả thư viện.
 */
export default domAnimation;

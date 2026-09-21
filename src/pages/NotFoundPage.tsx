import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-7xl font-black text-primary">404</div>
      <h1 className="text-3xl font-black text-text">Trang này không tồn tại</h1>
      <p className="mt-3 max-w-lg text-base text-text-muted">
        Có vẻ bạn đã đi nhầm tuyến đường. Hãy quay lại cửa hàng và tiếp tục khám phá Bakugan.
      </p>
      <Link to="/" className="mt-6 rounded-full bg-gradient-to-r from-primary to-accent-pink px-6 py-3 font-bold text-white">
        Quay về trang chủ
      </Link>
    </div>
  );
}

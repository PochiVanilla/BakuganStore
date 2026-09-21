import { Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-surface py-12">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent-pink/60 bg-white/5 text-base font-black text-primary shadow-[0_0_18px_rgba(123,75,232,0.8)]">
              TD
            </div>
            <div>
              <div className="text-lg font-black tracking-[0.12em] text-primary">TD</div>
              <div className="text-[10px] font-bold tracking-[0.35em] text-accent-cyan">BAKUGAN</div>
            </div>
          </div>
          <p className="text-sm leading-6 text-text-muted">
            Shop sưu tầm Bakugan chuyên hàng chính hãng, phiên bản hiếm, đấu giá và hỗ trợ người chơi lâu năm.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-bold text-text">Liên kết nhanh</h3>
          <ul className="space-y-3 text-sm text-text-muted">
            <li><a href="#" className="hover:text-text">Trang chủ</a></li>
            <li><a href="#" className="hover:text-text">Sản phẩm</a></li>
            <li><a href="#" className="hover:text-text">Hàng mới</a></li>
            <li><a href="#" className="hover:text-text">Đấu giá</a></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-bold text-text">Chính sách</h3>
          <ul className="space-y-3 text-sm text-text-muted">
            <li><a href="#" className="hover:text-text">Đổi trả hàng</a></li>
            <li><a href="#" className="hover:text-text">Vận chuyển</a></li>
            <li><a href="#" className="hover:text-text">Bảo mật</a></li>
            <li><a href="#" className="hover:text-text">Điều khoản</a></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-bold text-text">Liên hệ</h3>
          <ul className="space-y-3 text-sm text-text-muted">
            <li className="flex items-center gap-2"><MapPin size={14} className="text-accent-cyan" /> Hồ Chí Minh, Việt Nam</li>
            <li className="flex items-center gap-2"><Phone size={14} className="text-accent-cyan" /> 0934973962</li>
            <li className="flex items-center gap-2"><Mail size={14} className="text-accent-cyan" /> chauvuongphat123@gmail.com</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

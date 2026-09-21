export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-black text-text">Giỏ hàng</h1>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {[1, 2].map((item) => (
            <div key={item} className="flex gap-4 rounded-3xl border border-white/10 bg-surface p-4">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-[#1e1e2e] to-[#101017]" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-text">Bakugan Prime {item}</h3>
                    <p className="text-sm text-text-muted">Pyrus • Mới nguyên seal</p>
                  </div>
                  <div className="text-xl font-black text-gold">1.250.000₫</div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="rounded-full border border-white/10 px-3 py-1 text-text">-</button>
                    <span className="font-bold text-text">1</span>
                    <button className="rounded-full border border-white/10 px-3 py-1 text-text">+</button>
                  </div>
                  <button className="text-sm font-semibold text-pink-400">Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-3xl border border-white/10 bg-surface p-6">
          <h2 className="text-xl font-black text-text">Tổng đơn</h2>
          <div className="mt-6 space-y-3 text-sm text-text-muted">
            <div className="flex justify-between"><span>Tạm tính</span><span className="text-text">2.500.000₫</span></div>
            <div className="flex justify-between"><span>Phí vận chuyển</span><span className="text-text">0₫</span></div>
            <div className="flex justify-between"><span>Giảm giá</span><span className="text-text">-200.000₫</span></div>
          </div>
          <div className="mt-5 border-t border-white/10 pt-5 text-lg font-black text-text">
            <div className="flex justify-between"><span>Tổng cộng</span><span className="text-gold">2.300.000₫</span></div>
          </div>
          <button className="mt-6 w-full rounded-full bg-gradient-to-r from-primary to-accent-pink px-4 py-3 font-bold text-white">Thanh toán</button>
        </aside>
      </div>
    </div>
  );
}

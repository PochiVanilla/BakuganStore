export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Sản phẩm</p>
        <h1 className="mt-2 text-4xl font-black text-text">Tuyển tập Bakugan</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-white/10 bg-surface p-5">
          <h2 className="mb-4 text-lg font-bold text-text">Bộ lọc</h2>
          <div className="space-y-6 text-sm text-text-muted">
            <div>
              <div className="mb-2 font-semibold text-text">Hệ</div>
              <ul className="space-y-2">
                <li>Pyrus</li>
                <li>Aquos</li>
                <li>Subterra</li>
                <li>Darkus</li>
                <li>Ventus</li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-semibold text-text">Tình trạng</div>
              <ul className="space-y-2">
                <li>Mới nguyên seal</li>
                <li>Like new</li>
                <li>Đã qua sử dụng</li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-semibold text-text">Khoảng giá</div>
              <div className="rounded-xl bg-background p-3">300.000₫ - 3.000.000₫</div>
            </div>
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-white/10 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-text-muted">Hiển thị 1-12 trong 128 sản phẩm</div>
            <select className="rounded-full border border-white/10 bg-background px-4 py-2 text-sm text-text focus:outline-none">
              <option>Mới nhất</option>
              <option>Giá tăng dần</option>
              <option>Giá giảm dần</option>
              <option>Bán chạy</option>
            </select>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <article key={item} className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
                <div className="h-52 bg-gradient-to-br from-[#1e1e2e] to-[#101017] p-4">
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0b0b11] text-4xl font-black text-primary">TD</div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                    <span>Pyrus</span>
                    <span>NEW</span>
                  </div>
                  <h3 className="text-lg font-bold text-text">Bakugan Prime {item}</h3>
                  <div className="text-2xl font-black text-gold">1.250.000₫</div>
                  <button className="w-full rounded-full bg-gradient-to-r from-primary to-accent-pink px-4 py-2 text-sm font-bold text-white">
                    Thêm vào giỏ
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

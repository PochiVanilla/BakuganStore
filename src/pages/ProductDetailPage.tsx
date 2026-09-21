export default function ProductDetailPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="h-[420px] rounded-[28px] border border-white/10 bg-surface p-5">
            <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-[#0b0b11] text-[8rem] font-black text-primary">TD</div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-2xl border border-white/10 bg-surface" />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 inline-flex rounded-full bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-gold">HOT</div>
          <h1 className="text-4xl font-black text-text">Bakugan Pyrus Dragonoid</h1>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-3xl font-black text-gold">1.250.000₫</div>
            <div className="text-xl text-text-muted line-through">1.550.000₫</div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-text-muted">
            <div className="flex justify-between border-b border-white/10 pb-2"><span>Hệ</span><span className="text-text">Pyrus</span></div>
            <div className="flex justify-between border-b border-white/10 pb-2"><span>Series</span><span className="text-text">Battle Brawlers</span></div>
            <div className="flex justify-between border-b border-white/10 pb-2"><span>G-Power</span><span className="text-text">500 G</span></div>
            <div className="flex justify-between border-b border-white/10 pb-2"><span>Tình trạng</span><span className="text-text">Mới nguyên seal</span></div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button className="rounded-full border border-white/10 bg-surface-2 px-4 py-2 text-sm font-semibold text-text">-</button>
            <div className="w-12 text-center text-lg font-bold text-text">1</div>
            <button className="rounded-full border border-white/10 bg-surface-2 px-4 py-2 text-sm font-semibold text-text">+</button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-gradient-to-r from-primary to-accent-pink px-6 py-3 font-bold text-white">Thêm vào giỏ</button>
            <button className="rounded-full border border-accent-cyan/40 bg-surface-2 px-6 py-3 font-bold text-accent-cyan">Mua ngay</button>
          </div>
        </div>
      </div>
    </div>
  );
}

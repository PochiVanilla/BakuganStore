export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-black text-text">Sản phẩm yêu thích</h1>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <article key={item} className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
            <div className="h-52 bg-gradient-to-br from-[#1e1e2e] to-[#101017]" />
            <div className="space-y-3 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Darkus</div>
              <h3 className="text-lg font-bold text-text">Bakugan Favorite {item}</h3>
              <div className="text-2xl font-black text-gold">890.000₫</div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent-pink px-4 py-2 text-sm font-bold text-white">Thêm giỏ</button>
                <button className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-text">Xóa</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

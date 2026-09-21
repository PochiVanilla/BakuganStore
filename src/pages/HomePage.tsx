import { ArrowRight, Flame, ShieldCheck, Sparkles, Star, TimerReset } from 'lucide-react';

const categories = [
  { name: 'Pyrus', color: 'from-red-500 to-orange-400' },
  { name: 'Aquos', color: 'from-cyan-500 to-blue-400' },
  { name: 'Subterra', color: 'from-amber-500 to-yellow-400' },
  { name: 'Haos', color: 'from-emerald-500 to-green-400' },
  { name: 'Darkus', color: 'from-violet-500 to-purple-500' },
  { name: 'Ventus', color: 'from-pink-500 to-fuchsia-400' },
];

const products = [
  { name: 'Bakugan Pyrus Dragonoid', price: 1250000, oldPrice: 1550000, tag: 'HOT', status: 'Còn hàng' },
  { name: 'Bakugan Darkus Gorem', price: 890000, oldPrice: 1200000, tag: 'NEW', status: 'Hàng hiếm' },
  { name: 'Bakugan Aquos Seidon', price: 980000, oldPrice: 1280000, tag: 'SALE', status: 'Còn hàng' },
  { name: 'Bakugan Ventus Tigrerra', price: 760000, oldPrice: 990000, tag: 'NEW', status: 'Like new' },
];

const benefits = [
  { title: 'Hàng chính hãng', icon: ShieldCheck, text: 'Kiểm tra kỹ từng sản phẩm trước khi phát hành.' },
  { title: 'Đóng gói an toàn', icon: Sparkles, text: 'Bọc chống sốc, bảo vệ card và hộp nguyên vẹn.' },
  { title: 'Dịch vụ nhanh', icon: TimerReset, text: 'Giao hàng thanh toán linh hoạt, cập nhật rõ ràng.' },
];

export default function HomePage() {
  return (
    <div className="pb-16">
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-cyan-400/20 bg-surface p-6 shadow-[0_0_40px_rgba(63,227,245,0.18)] sm:p-8 lg:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                <Flame size={14} />
                Battle Night Edition
              </div>
              <h1 className="max-w-xl text-4xl font-black leading-tight text-text sm:text-5xl lg:text-6xl">
                <span className="neon-text text-primary">TD</span> Bakugan
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-text-muted sm:text-lg">
                Khám phá bộ sưu tập Bakugan chính hãng, phiên bản hiếm, item đấu giá và phụ kiện dành cho người chơi sưu tầm Việt Nam.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button className="gradient-btn rounded-full px-6 py-3 text-sm font-bold text-white transition hover:scale-[1.02]">
                  Mua ngay
                </button>
                <button className="rounded-full border border-accent-cyan/40 bg-surface-2 px-6 py-3 text-sm font-bold text-accent-cyan transition hover:border-accent-cyan hover:shadow-[0_0_18px_rgba(63,227,245,0.5)]">
                  Xem đấu giá
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-text-muted">
                <div>
                  <div className="text-2xl font-black text-text">24K+</div>
                  <div>Người chơi tin tưởng</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-text">1.8K</div>
                  <div>Sản phẩm hiếm</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-text">4.9/5</div>
                  <div>Đánh giá</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(245,197,66,0.28),_transparent_55%)]" />
                <div className="relative mx-auto flex aspect-square w-full max-w-[380px] items-center justify-center rounded-full border border-white/10 bg-[#04040a] shadow-[0_0_50px_rgba(123,75,232,0.4)]">
                  <div className="flex h-[72%] w-[72%] items-center justify-center rounded-full border-[10px] border-primary/80 bg-[#0d0d17] text-[7rem] font-black tracking-[-0.08em] text-primary shadow-[0_0_30px_rgba(123,75,232,0.7)]">
                    TD
                  </div>
                  <div className="absolute bottom-8 text-center">
                    <div className="text-2xl font-black tracking-[0.3em] text-accent-cyan">BAKUGAN</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Hệ Bakugan</p>
            <h2 className="mt-2 text-3xl font-black text-text">Khám phá theo hệ</h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {categories.map((category) => (
            <div key={category.name} className="glow-card rounded-2xl border border-white/8 bg-surface p-4 transition hover:-translate-y-1 hover:border-accent-cyan/60">
              <div className={`mb-3 h-20 rounded-xl bg-gradient-to-br ${category.color}`} />
              <div className="text-base font-bold text-text">{category.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Hàng mới</p>
            <h2 className="mt-2 text-3xl font-black text-text">Sản phẩm mới về</h2>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-accent-cyan hover:text-cyan-300">
            Xem tất cả <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <article key={product.name} className="glow-card overflow-hidden rounded-3xl border border-white/10 bg-surface">
              <div className="relative h-60 bg-gradient-to-br from-white/5 to-surface-2 p-3">
                <div className="absolute left-3 top-3 rounded-full bg-gold px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-background">
                  {product.tag}
                </div>
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0b0b11] text-4xl font-black text-primary">
                  TD
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  <span>Bakugan</span>
                  <span>{product.status}</span>
                </div>
                <h3 className="text-lg font-bold text-text">{product.name}</h3>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Star size={14} className="fill-gold text-gold" />
                  4.9 (128 đánh giá)
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-black text-gold">{product.price.toLocaleString('vi-VN')}₫</div>
                    <div className="text-sm text-text-muted line-through">{product.oldPrice.toLocaleString('vi-VN')}₫</div>
                  </div>
                  <button className="rounded-full bg-accent-cyan/15 px-3 py-2 text-xs font-bold text-accent-cyan hover:bg-accent-cyan/25">
                    Thêm giỏ
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-accent-pink/20 bg-surface p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Phiên đấu giá</p>
              <h2 className="mt-2 text-3xl font-black text-text">Đang diễn ra</h2>
            </div>
            <div className="rounded-full border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-bold text-gold">
              02:14:35
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-background p-4">
                <div className="mb-4 h-44 rounded-xl bg-gradient-to-br from-[#1e1e2e] to-[#0f0f17]" />
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-text-muted">
                  <span>Darkus</span>
                  <span>12 lượt bid</span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-text">Bakugan Dragonite Prime</h3>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-text-muted">Giá hiện tại</div>
                    <div className="text-2xl font-black text-gold">1.540.000₫</div>
                  </div>
                  <button className="rounded-full bg-gradient-to-r from-primary to-accent-pink px-4 py-2 text-xs font-bold text-white">
                    Đặt giá
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Cam kết</p>
          <h2 className="mt-2 text-3xl font-black text-text">Nền tảng mua bán đáng tin cậy</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {benefits.map(({ title, icon: Icon, text }) => (
            <div key={title} className="glow-card rounded-3xl border border-white/10 bg-surface p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-cyan/10 text-accent-cyan">
                <Icon size={22} />
              </div>
              <h3 className="text-xl font-bold text-text">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

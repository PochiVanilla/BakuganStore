import { Award, Heart, PackageCheck, Search, ShieldCheck, Users } from 'lucide-react';
import { ROUTES, SHOP_INFO } from '@/constants/routes';
import { bannerPlaceholder } from '@/utils/placeholder';
import { ButtonLink, Container, SectionHeading, Seo } from '@/components/ui';

const MILESTONES = [
  {
    year: '2021',
    title: 'Bắt đầu từ một tủ kính',
    text: 'Shop khởi đầu chỉ với bộ sưu tập cá nhân và vài đơn hàng gửi cho bạn bè trong nhóm chơi Bakugan.',
  },
  {
    year: '2022',
    title: 'Nhập lô hàng chính ngạch đầu tiên',
    text: 'Chuyển từ gom hàng lẻ sang nhập trực tiếp, đảm bảo nguồn gốc và số lượng ổn định hơn cho người chơi.',
  },
  {
    year: '2024',
    title: 'Mở sàn đấu giá',
    text: 'Những món hiếm không còn bán theo kiểu "ai nhắn trước được trước" mà đưa lên đấu giá công khai, minh bạch.',
  },
  {
    year: '2026',
    title: 'Hơn 2.400 đơn hàng',
    text: 'Cộng đồng khách quen phủ khắp ba miền, phần lớn đơn hàng mới đến từ giới thiệu của người mua cũ.',
  },
];

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Trung thực về tình trạng',
    text: 'Có vết xước là nói có vết xước. Mọi khuyết điểm đều được chụp ảnh và ghi rõ trong mô tả.',
    color: '#3FE3F5',
  },
  {
    icon: Search,
    title: 'Kiểm tra trước khi bán',
    text: 'Không quả nào lên kệ mà chưa qua 10 lần thử cơ cấu bung nở và kiểm tra lực nam châm.',
    color: '#E940D2',
  },
  {
    icon: PackageCheck,
    title: 'Đóng gói như đồ của mình',
    text: 'Xốp hai lớp, chèn kín, hộp cứng. Đơn trên 1 triệu đều có video khi đóng gói.',
    color: '#F5C542',
  },
  {
    icon: Heart,
    title: 'Vì cộng đồng, không chỉ vì đơn hàng',
    text: 'Shop tư vấn cả khi bạn không mua, và sẵn sàng chỉ chỗ khác nếu bên đó có món phù hợp hơn.',
    color: '#7B4BE8',
  },
];

const STATS = [
  { icon: Users, value: '2.400+', label: 'Đơn hàng đã giao' },
  { icon: Award, value: '4,9/5', label: 'Điểm đánh giá trung bình' },
  { icon: PackageCheck, value: '150+', label: 'Mẫu Bakugan đã bán' },
];

export default function AboutPage() {
  return (
    <>
      <Seo
        title="Giới thiệu"
        description="Câu chuyện của TD Bakugan — từ một tủ kính cá nhân đến shop Bakugan chính hãng và sàn đấu giá cho cộng đồng người chơi Việt Nam."
        path={ROUTES.about}
      />

      <Container className="py-8 sm:py-12">
        {/* Hero */}
        <section className="relative mb-14 overflow-hidden rounded-3xl border border-white/8 bg-surface/70">
          <img
            src={bannerPlaceholder('TD Bakugan Story', 1)}
            alt=""
            width={1200}
            height={630}
            className="h-56 w-full object-cover opacity-40 sm:h-72"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
              <span className="text-gradient-neon">Câu chuyện TD Bakugan</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
              Chúng tôi bắt đầu từ chính niềm vui khi nghe tiếng &ldquo;tách&rdquo; lúc quả cầu bung
              ra trên thẻ bài — và muốn giữ nguyên cảm giác đó cho mọi người chơi Việt Nam.
            </p>
          </div>
        </section>

        {/* Câu chuyện */}
        <section className="mb-16 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionHeading eyebrow="CHÚNG TÔI LÀ AI" title="Người chơi bán hàng cho người chơi" />
            <div className="space-y-4 text-sm leading-relaxed text-text-muted sm:text-base">
              <p>
                TD Bakugan không phải một cửa hàng đồ chơi thông thường. Đội ngũ của shop đều là
                người sưu tầm Bakugan từ thời Battle Brawlers còn chiếu trên TV, và hiểu rất rõ cảm
                giác mua phải hàng nhái nam châm yếu hay nhận được quả bị nứt vỏ vì đóng gói ẩu.
              </p>
              <p>
                Vì vậy shop chọn cách làm chậm hơn nhưng chắc chắn: kiểm tra từng sản phẩm, chụp ảnh
                thật, mô tả đúng tình trạng kể cả khi điều đó làm giá bán thấp đi. Khách mua một lần
                rồi quay lại — đó là thước đo duy nhất chúng tôi quan tâm.
              </p>
              <p>
                Năm 2024 shop mở thêm sàn đấu giá để những món thật sự hiếm được định giá công bằng
                bởi chính cộng đồng, thay vì bán cho ai nhắn tin nhanh nhất.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to={ROUTES.products}>Xem bộ sưu tập</ButtonLink>
              <ButtonLink to={ROUTES.contact} variant="outline">
                Liên hệ với shop
              </ButtonLink>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:content-start">
            {STATS.map((stat) => (
              <li
                key={stat.label}
                className="flex items-center gap-4 rounded-2xl border border-white/8 bg-surface/70 p-5"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent-cyan/35 bg-accent-cyan/10 text-accent-cyan"
                  aria-hidden="true"
                >
                  <stat.icon size={21} />
                </span>
                <span>
                  <span className="block font-display text-2xl font-extrabold text-text">
                    {stat.value}
                  </span>
                  <span className="block text-sm text-text-muted">{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Cột mốc */}
        <section className="mb-16">
          <SectionHeading eyebrow="HÀNH TRÌNH" title="Những cột mốc đáng nhớ" align="center" />
          <ol className="relative mx-auto max-w-3xl">
            <span
              className="absolute top-4 bottom-4 left-[7px] w-px bg-gradient-to-b from-accent-cyan/60 via-primary/50 to-accent-pink/60 sm:left-[11px]"
              aria-hidden="true"
            />
            {MILESTONES.map((milestone) => (
              <li key={milestone.year} className="relative mb-8 pl-8 last:mb-0 sm:pl-12">
                <span
                  className="absolute top-1.5 left-0 h-4 w-4 rounded-full border-2 border-accent-cyan bg-background shadow-glow-cyan sm:h-6 sm:w-6"
                  aria-hidden="true"
                />
                <span className="font-display text-sm font-bold text-gold">{milestone.year}</span>
                <h3 className="mt-1 font-display text-lg font-bold text-text">{milestone.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{milestone.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Giá trị */}
        <section className="mb-16">
          <SectionHeading eyebrow="CAM KẾT" title="Bốn điều shop không thoả hiệp" align="center" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {VALUES.map((value) => (
              <li
                key={value.title}
                className="rounded-2xl border border-white/8 bg-surface/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl border"
                  style={{
                    borderColor: `${value.color}55`,
                    backgroundColor: `${value.color}18`,
                    color: value.color,
                  }}
                  aria-hidden="true"
                >
                  <value.icon size={22} />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-text">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{value.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-accent-pink/25 bg-gradient-to-br from-primary/12 via-surface/70 to-accent-pink/12 p-8 text-center sm:p-12">
          <h2 className="font-display text-2xl font-extrabold text-text sm:text-3xl">
            Ghé shop chơi nhé!
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted sm:text-base">
            Shop mở cửa {SHOP_INFO.workingHours} tại {SHOP_INFO.address}. Bạn có thể đến xem hàng
            trực tiếp, thử bung nở thoải mái trước khi quyết định mua.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink to={ROUTES.contact} size="lg">
              Xem bản đồ &amp; liên hệ
            </ButtonLink>
            <ButtonLink to={ROUTES.auctions} size="lg" variant="outline">
              Vào sàn đấu giá
            </ButtonLink>
          </div>
        </section>
      </Container>
    </>
  );
}

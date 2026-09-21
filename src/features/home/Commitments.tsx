import { BadgeCheck, PackageCheck, RefreshCw, Search } from 'lucide-react';
import { Container, SectionHeading } from '@/components/ui';

const ITEMS = [
  {
    icon: BadgeCheck,
    title: 'Hàng chính hãng',
    description:
      'Mọi sản phẩm đều nhập từ nguồn uy tín, có kiểm tra mã series và lực nam châm trước khi lên kệ.',
    color: '#3FE3F5',
  },
  {
    icon: Search,
    title: 'Kiểm tra kỹ từng quả',
    description:
      'Thử cơ cấu bung nở 10 lần, vệ sinh khoang nam châm và chụp ảnh thực tế cho từng sản phẩm.',
    color: '#E940D2',
  },
  {
    icon: PackageCheck,
    title: 'Đóng gói chống sốc',
    description:
      'Bọc xốp hai lớp, hộp cứng, có quay video khi đóng gói cho mọi đơn hàng trên 1 triệu đồng.',
    color: '#F5C542',
  },
  {
    icon: RefreshCw,
    title: 'Đổi trả 7 ngày',
    description:
      'Hoàn tiền hoặc đổi sản phẩm khác nếu phát hiện lỗi từ nhà sản xuất trong vòng 7 ngày.',
    color: '#7B4BE8',
  },
];

export function Commitments() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeading
          eyebrow="CAM KẾT CỦA SHOP"
          title="Vì sao người chơi chọn TD Bakugan"
          align="center"
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <li
              key={item.title}
              className="group rounded-2xl border border-white/8 bg-surface/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-xl border transition-transform duration-300 group-hover:scale-110"
                style={{
                  borderColor: `${item.color}55`,
                  backgroundColor: `${item.color}18`,
                  color: item.color,
                  boxShadow: `0 0 20px -6px ${item.color}`,
                }}
                aria-hidden="true"
              >
                <item.icon size={22} />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-text">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

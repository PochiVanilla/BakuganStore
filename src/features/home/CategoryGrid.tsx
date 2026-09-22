import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES } from '@/types';
import { ATTRIBUTE_META, SERIES_META } from '@/constants/catalog';
import { ROUTES } from '@/constants/routes';
import { AttributeIcon, Container, SectionHeading } from '@/components/ui';

export function AttributeGrid() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeading
          eyebrow="DANH MỤC NỔI BẬT"
          title="Chọn theo hệ chiến đấu"
          description="Sáu hệ Bakugan với lối chơi và sức mạnh riêng — tìm ngay hệ bạn đang gom."
        />

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {BAKUGAN_ATTRIBUTES.map((attribute) => {
            const meta = ATTRIBUTE_META[attribute];
            return (
              <li key={attribute}>
                <Link
                  to={`${ROUTES.products}?he=${attribute}`}
                  className="group relative flex h-full flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/8 bg-surface/80 p-5 text-center transition-all duration-300 hover:-translate-y-1"
                  style={{ ['--attr-color' as string]: meta.color }}
                >
                  <span
                    className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(circle at 50% 0%, ${meta.color}26, transparent 70%)`,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className="relative grid h-14 w-14 place-items-center rounded-full border-2 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      borderColor: `${meta.color}88`,
                      backgroundColor: `${meta.color}1F`,
                      boxShadow: `0 0 18px -4px ${meta.color}`,
                      color: meta.color,
                    }}
                    aria-hidden="true"
                  >
                    <AttributeIcon attribute={attribute} size={30} glow />
                  </span>
                  <span className="relative">
                    <span className="block font-display text-sm font-bold text-text">
                      {meta.label}
                    </span>
                    <span className="mt-1 block text-[11px] text-text-muted">{meta.element}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

export function SeriesGrid() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeading
          eyebrow="DÒNG SẢN PHẨM"
          title="Sưu tầm theo series"
          description="Từ Battle Brawlers đời đầu 2007 đến Geogan Rising hiện đại."
          action={
            <Link
              to={ROUTES.products}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-cyan transition hover:text-accent-pink"
            >
              Xem tất cả sản phẩm
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          }
        />

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BAKUGAN_SERIES.map((series) => {
            const meta = SERIES_META[series];
            return (
              <li key={series}>
                <Link
                  to={`${ROUTES.products}?series=${series}`}
                  className="group flex h-full flex-col rounded-2xl border border-white/8 bg-surface/80 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-pink/40 hover:shadow-[0_18px_40px_-22px_rgba(233,64,210,0.8)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-base font-bold text-text transition-colors group-hover:text-accent-pink">
                      {meta.label}
                    </h3>
                    <span className="shrink-0 rounded-md border border-white/10 bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-muted">
                      {meta.years}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
                    {meta.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-cyan">
                    Xem sản phẩm
                    <ArrowUpRight
                      size={13}
                      className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

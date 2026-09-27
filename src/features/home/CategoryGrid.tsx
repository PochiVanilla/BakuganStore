import { Link } from 'react-router-dom';
import { BAKUGAN_ATTRIBUTES } from '@/types';
import { ATTRIBUTE_META } from '@/constants/catalog';
import { ROUTES } from '@/constants/routes';
import { AttributeIcon, Container, SectionHeading } from '@/components/ui';

export function AttributeGrid() {
  return (
    <section className="py-8 sm:py-12">
      <Container>
        <SectionHeading
          eyebrow="TÌM THEO HỆ"
          title="Chọn theo hệ chiến đấu"
          description="Sáu hệ Bakugan với lối chơi và sức mạnh riêng — bấm để xem những con đang bán trong các feed."
        />

        <ul className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-6">
          {BAKUGAN_ATTRIBUTES.map((attribute) => {
            const meta = ATTRIBUTE_META[attribute];
            return (
              <li key={attribute}>
                <Link
                  to={`${ROUTES.feeds}?he=${attribute}`}
                  className="group relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-2xl border border-white/8 bg-surface/80 px-2 py-3.5 text-center transition-all duration-300 hover:-translate-y-1 sm:gap-3 sm:p-5"
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
                    className="relative grid h-11 w-11 place-items-center rounded-full border-2 transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14"
                    style={{
                      borderColor: `${meta.color}88`,
                      backgroundColor: `${meta.color}1F`,
                      boxShadow: `0 0 18px -4px ${meta.color}`,
                      color: meta.color,
                    }}
                    aria-hidden="true"
                  >
                    <AttributeIcon attribute={attribute} size={24} glow />
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

import { ROUTES } from '@/constants/routes';
import { Container, Seo } from '@/components/ui';
import { TermsContent, PrivacyContent } from '@/features/auth/legalContent';

interface LegalPageProps {
  variant: 'terms' | 'privacy' | 'shipping' | 'returns';
}

const META = {
  terms: {
    title: 'Điều khoản sử dụng',
    description: 'Điều khoản sử dụng website và dịch vụ của TD Bakugan.',
    path: ROUTES.terms,
  },
  privacy: {
    title: 'Chính sách bảo mật',
    description: 'Cách TD Bakugan thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn.',
    path: ROUTES.privacy,
  },
  shipping: {
    title: 'Chính sách vận chuyển',
    description: 'Thời gian giao hàng, phí vận chuyển và cách đóng gói của TD Bakugan.',
    path: ROUTES.shipping,
  },
  returns: {
    title: 'Chính sách đổi trả',
    description: 'Điều kiện và quy trình đổi trả sản phẩm tại TD Bakugan.',
    path: ROUTES.returns,
  },
} as const;

function PolicySection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="mb-2.5 font-display text-base font-bold text-text">{title}</h2>
      <ul className="space-y-2 pl-4">
        {items.map((item) => (
          <li key={item} className="list-disc text-sm leading-relaxed text-text-muted">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShippingContent() {
  return (
    <div>
      <p className="mb-6 text-sm leading-relaxed text-text-muted">
        TD Bakugan giao hàng toàn quốc qua các đơn vị vận chuyển uy tín. Mọi đơn hàng đều được đóng
        gói chống sốc và có mã vận đơn để bạn theo dõi.
      </p>
      <PolicySection
        title="1. Thời gian giao hàng"
        items={[
          'Nội thành TP.HCM: 1 – 2 ngày làm việc.',
          'Các tỉnh thành khác: 2 – 5 ngày làm việc tuỳ khu vực.',
          'Đơn đặt trước ngày lễ có thể chậm hơn 1 – 2 ngày.',
        ]}
      />
      <PolicySection
        title="2. Phí vận chuyển"
        items={[
          'Phí cố định 30.000₫ cho mọi đơn hàng.',
          'Miễn phí vận chuyển cho đơn từ 800.000₫.',
          'Mã FREESHIP áp dụng cho đơn từ 300.000₫.',
        ]}
      />
      <PolicySection
        title="3. Đóng gói"
        items={[
          'Bọc xốp hai lớp cho từng sản phẩm, chèn giấy chống xê dịch.',
          'Hộp carton cứng, dán niêm phong có logo shop.',
          'Quay video khi đóng gói cho mọi đơn hàng trên 1.000.000₫.',
        ]}
      />
      <PolicySection
        title="4. Kiểm tra khi nhận hàng"
        items={[
          'Bạn được đồng kiểm với nhân viên giao hàng trước khi thanh toán.',
          'Nếu phát hiện hư hỏng do vận chuyển, vui lòng từ chối nhận và báo shop ngay trong ngày.',
        ]}
      />
    </div>
  );
}

function ReturnsContent() {
  return (
    <div>
      <p className="mb-6 text-sm leading-relaxed text-text-muted">
        Shop nhận đổi trả trong 7 ngày kể từ khi bạn nhận hàng, áp dụng cho các trường hợp dưới đây.
      </p>
      <PolicySection
        title="1. Trường hợp được đổi trả"
        items={[
          'Sản phẩm bị lỗi cơ cấu bung nở hoặc mất từ tính nam châm.',
          'Giao sai mẫu, sai hệ hoặc sai tình trạng so với mô tả trên website.',
          'Sản phẩm hư hỏng trong quá trình vận chuyển (có ảnh/video khi mở hộp).',
        ]}
      />
      <PolicySection
        title="2. Trường hợp không áp dụng"
        items={[
          'Sản phẩm đã qua sử dụng, có dấu vết va đập do người mua.',
          'Hàng đấu giá thắng phiên (được mô tả và chụp ảnh chi tiết trước khi đấu).',
          'Quá 7 ngày kể từ ngày nhận hàng.',
        ]}
      />
      <PolicySection
        title="3. Quy trình đổi trả"
        items={[
          'Liên hệ hotline hoặc Zalo của shop kèm ảnh/video sản phẩm.',
          'Shop xác nhận trong vòng 24 giờ làm việc.',
          'Gửi sản phẩm về địa chỉ shop — phí chiều về do shop chịu nếu lỗi từ shop.',
          'Hoàn tiền trong 3 – 5 ngày làm việc hoặc đổi sản phẩm khác theo yêu cầu.',
        ]}
      />
    </div>
  );
}

export default function LegalPage({ variant }: LegalPageProps) {
  const meta = META[variant];

  return (
    <>
      <Seo title={meta.title} description={meta.description} path={meta.path} />

      <Container className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-2 text-sm text-text-muted">Cập nhật lần cuối: tháng 9/2026</p>

          <div className="mt-8 rounded-2xl border border-white/8 bg-surface/80 p-6 sm:p-8">
            {variant === 'terms' && <TermsContent />}
            {variant === 'privacy' && <PrivacyContent />}
            {variant === 'shipping' && <ShippingContent />}
            {variant === 'returns' && <ReturnsContent />}
          </div>
        </div>
      </Container>
    </>
  );
}

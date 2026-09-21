import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleCheck, Clock, Mail, MapPin, MessageCircle, Phone, Send, User } from 'lucide-react';
import { ROUTES, SHOP_INFO } from '@/constants/routes';
import { emailSchema, fullNameSchema, phoneSchema } from '@/features/auth/schemas';
import { sendContactMessage } from '@/services/api/contactService';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Button, Container, Input, Seo, Textarea } from '@/components/ui';

const contactSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  subject: z
    .string()
    .trim()
    .min(3, 'Tiêu đề cần ít nhất 3 ký tự.')
    .max(100, 'Tiêu đề tối đa 100 ký tự.'),
  message: z
    .string()
    .trim()
    .min(10, 'Nội dung cần ít nhất 10 ký tự.')
    .max(1000, 'Nội dung tối đa 1000 ký tự.'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const CONTACT_INFO = [
  { icon: MapPin, label: 'Địa chỉ', value: SHOP_INFO.address },
  {
    icon: Phone,
    label: 'Hotline',
    value: SHOP_INFO.hotline,
    href: `tel:${SHOP_INFO.hotline.replace(/\s/g, '')}`,
  },
  { icon: Mail, label: 'Email', value: SHOP_INFO.email, href: `mailto:${SHOP_INFO.email}` },
  { icon: Clock, label: 'Giờ mở cửa', value: SHOP_INFO.workingHours },
];

export default function ContactPage() {
  const [ticketId, setTicketId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { fullName: '', email: '', phone: '', subject: '', message: '' },
  });

  const onSubmit = async (values: ContactFormValues): Promise<void> => {
    try {
      const result = await sendContactMessage(values);
      setTicketId(result.ticketId);
      reset();
      toast.success('Đã gửi tin nhắn!', `Mã hỗ trợ của bạn: ${result.ticketId}`);
    } catch (error) {
      toast.error('Gửi tin nhắn thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <>
      <Seo
        title="Liên hệ"
        description={`Liên hệ TD Bakugan qua hotline ${SHOP_INFO.hotline}, Zalo, Messenger hoặc ghé trực tiếp cửa hàng tại ${SHOP_INFO.address}.`}
        path={ROUTES.contact}
      />

      <Container className="py-8 sm:py-12">
        <header className="mb-10">
          <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
            Liên hệ với shop
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted sm:text-base">
            Cần tư vấn về sản phẩm, tình trạng hàng hay thể lệ đấu giá? Nhắn cho shop, thường phản
            hồi trong vòng 2 giờ làm việc.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Form */}
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-white/8 bg-surface/80 p-6 sm:p-8">
              {ticketId ? (
                <div className="py-8 text-center">
                  <span
                    className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-success/40 bg-success/10 text-success"
                    aria-hidden="true"
                  >
                    <CircleCheck size={30} />
                  </span>
                  <h2 className="mt-5 font-display text-xl font-bold text-text">
                    Đã nhận được tin nhắn của bạn!
                  </h2>
                  <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-text-muted">
                    Mã hỗ trợ: <span className="font-display font-bold text-gold">{ticketId}</span>.
                    Shop sẽ liên hệ lại qua điện thoại hoặc email trong vòng 2 giờ làm việc.
                  </p>
                  <Button variant="secondary" className="mt-6" onClick={() => setTicketId(null)}>
                    Gửi tin nhắn khác
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="mb-5 font-display text-lg font-bold text-text">Gửi tin nhắn</h2>
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="flex flex-col gap-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Họ và tên"
                        placeholder="Nguyễn Văn An"
                        autoComplete="name"
                        required
                        leftIcon={<User size={17} />}
                        error={errors.fullName?.message}
                        {...register('fullName')}
                      />
                      <Input
                        label="Số điện thoại"
                        type="tel"
                        inputMode="numeric"
                        placeholder="0912345678"
                        autoComplete="tel"
                        required
                        leftIcon={<Phone size={17} />}
                        error={errors.phone?.message}
                        {...register('phone')}
                      />
                    </div>

                    <Input
                      label="Email"
                      type="email"
                      placeholder="ban@email.com"
                      autoComplete="email"
                      required
                      leftIcon={<Mail size={17} />}
                      error={errors.email?.message}
                      {...register('email')}
                    />

                    <Input
                      label="Tiêu đề"
                      placeholder="VD: Hỏi về tình trạng Hydranoid nguyên hộp"
                      required
                      error={errors.subject?.message}
                      {...register('subject')}
                    />

                    <Textarea
                      label="Nội dung"
                      placeholder="Mô tả chi tiết câu hỏi của bạn…"
                      required
                      error={errors.message?.message}
                      {...register('message')}
                    />

                    <Button
                      type="submit"
                      size="lg"
                      fullWidth
                      isLoading={isSubmitting}
                      leftIcon={<Send size={17} />}
                    >
                      {isSubmitting ? 'Đang gửi…' : 'Gửi tin nhắn'}
                    </Button>
                  </form>
                </>
              )}
            </div>

            {/* Bản đồ */}
            <section className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-surface/80">
              <h2 className="border-b border-white/8 px-6 py-4 font-display text-base font-bold text-text">
                Bản đồ đường đi
              </h2>
              <iframe
                title={`Bản đồ vị trí ${SHOP_INFO.name}`}
                src={SHOP_INFO.mapEmbedUrl}
                width="100%"
                height="360"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="block border-0 grayscale-[35%]"
              />
            </section>
          </div>

          {/* Thông tin liên hệ */}
          <aside className="order-1 lg:order-2">
            <div className="rounded-2xl border border-white/8 bg-surface/80 p-6">
              <h2 className="mb-5 font-display text-base font-bold text-text">Thông tin liên hệ</h2>
              <ul className="space-y-4">
                {CONTACT_INFO.map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"
                      aria-hidden="true"
                    >
                      <item.icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-text-muted">{item.label}</span>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="block text-sm font-medium text-text transition hover:text-gold"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <span className="block text-sm font-medium text-text">{item.value}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2.5 border-t border-white/8 pt-5">
                <p className="text-sm text-text-muted">Nhắn tin nhanh:</p>
                <a
                  href={SHOP_INFO.zaloUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[#0068FF]/50 bg-[#0068FF]/12 font-semibold text-[#4D9BFF] transition hover:bg-[#0068FF]/20"
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  Chat qua Zalo
                </a>
                <a
                  href={SHOP_INFO.messengerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-accent-pink/45 bg-accent-pink/12 font-semibold text-accent-pink transition hover:bg-accent-pink/20"
                >
                  <Send size={18} aria-hidden="true" />
                  Chat qua Messenger
                </a>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/8 p-5">
              <h3 className="font-display text-sm font-bold text-gold">Mẹo nhỏ</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                Khi hỏi về một sản phẩm cụ thể, gửi kèm link sản phẩm giúp shop trả lời nhanh hơn
                nhiều.
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}

import { useState, type FormEvent } from 'react';
import {
  Bot,
  CircleCheck,
  CircleDashed,
  CircleX,
  FlaskConical,
  Landmark,
  RotateCcw,
  Save,
} from 'lucide-react';
import type {
  BotReply,
  BotSettings,
  BotTopicId,
  InternationalShippingSettings,
  ShopSettings,
} from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import { CONSULT_STARTER } from '@/constants/chat';
import { PURCHASES_FOR_LV2 } from '@/constants/catalog';
import { CARD_HOLD_MINUTES, DELIVERY_ESTIMATE, ZONE_LABELS } from '@/constants/shipping';
import {
  getBotSettings,
  getShopSettings,
  resetDemoData,
  updateBotSettings,
  updateShopSettings,
} from '@/services/api/admin';
import {
  askBot,
  checkBotEndpoint,
  FALLBACK_REASON_TEXT,
  testBotConnection,
} from '@/services/api/botService';
import { previewBotKnowledge } from '@/services/api/chatService';
import { getApiErrorMessage, USE_MOCK } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, Checkbox, Input, Modal, Seo, Skeleton, Textarea } from '@/components/ui';
import { AdminPageHeader, ErrorBox, Panel } from '@/features/admin/adminUi';
import { BOT_TOPIC_META } from '@/features/chat/botTopics';
import { linksFromText } from '@/features/chat/botKnowledge';
import { runConsult } from '@/features/chat/consultFlow';

type EditableBotSettings = Omit<BotSettings, 'updatedAt'>;

function ConnectionStatus() {
  const { data, isLoading } = useAsync(() => checkBotEndpoint(), []);
  const [isTesting, setIsTesting] = useState(false);
  const [test, setTest] = useState<Awaited<ReturnType<typeof testBotConnection>> | null>(null);

  const runTest = async (): Promise<void> => {
    setIsTesting(true);
    try {
      setTest(await testBotConnection());
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  const status = data?.status ?? 'unreachable';
  const failed = test && !test.ok ? FALLBACK_REASON_TEXT[test.reason] : null;
  const view =
    test?.ok === true
      ? {
          icon: CircleCheck,
          tone: 'border-success/30 bg-success/8 text-success',
          title: `Gemini đang trả lời bình thường${test.model ? ` (${test.model})` : ''}`,
          text: 'Khách được AI trả lời. Khi hết hạn mức miễn phí, bot tự chuyển sang bộ trả lời theo từ khoá rồi quay lại AI khi có hạn mức.',
        }
      : failed
        ? {
            icon: CircleX,
            tone: 'border-danger/30 bg-danger/8 text-danger',
            title: failed.title,
            text: failed.fix,
          }
        : status === 'ready'
          ? {
              icon: CircleDashed,
              tone: 'border-accent-cyan/30 bg-accent-cyan/8 text-accent-cyan',
              title: 'Đã có GEMINI_API_KEY trên server',
              text: 'Bấm "Kiểm tra kết nối" để gửi thử một câu và chắc chắn khoá dùng được.',
            }
          : status === 'not-configured'
            ? {
                icon: CircleDashed,
                tone: 'border-warning/30 bg-warning/8 text-warning',
                title: 'Chưa có GEMINI_API_KEY — bot đang trả lời theo từ khoá',
                text: FALLBACK_REASON_TEXT['not-configured'].fix,
              }
            : {
                icon: CircleX,
                tone: 'border-white/15 bg-white/4 text-text-muted',
                title: FALLBACK_REASON_TEXT.unreachable.title,
                text: FALLBACK_REASON_TEXT.unreachable.fix,
              };

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row', view.tone)}>
      <view.icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-sm font-semibold">{view.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{view.text}</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 self-start"
        isLoading={isTesting}
        onClick={() => void runTest()}
      >
        Kiểm tra kết nối
      </Button>
    </div>
  );
}

const PLAYGROUND_SAMPLES = [
  'Còn con Dragonoid nào không shop?',
  CONSULT_STARTER,
  'Feed sau mở bán lúc mấy giờ?',
  'Làm sao lên Lv2 để đấu giá?',
];

function BotPlayground({ settings }: { settings: EditableBotSettings }) {
  const [question, setQuestion] = useState(PLAYGROUND_SAMPLES[0]!);
  const [answer, setAnswer] = useState<BotReply | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const knowledge = useAsync(() => previewBotKnowledge(), []);

  const ask = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!question.trim() || !knowledge.data) return;
    setIsAsking(true);
    try {
      const topics = BOT_TOPIC_IDS.filter((topic) => settings.topics[topic]);
      // Câu mở đầu phần tư vấn chọn Bakugan chạy bằng luật cố định, như trong khung chat thật.
      const consult = runConsult({
        message: question.trim(),
        knowledge: knowledge.data,
        enabled: topics.includes('product-info'),
      });
      if (consult.kind === 'reply') {
        setAnswer(consult.reply);
        return;
      }
      const reply = await askBot({
        messages: [{ role: 'customer', text: question.trim() }],
        topics,
        extraKnowledge: settings.extraKnowledge,
        knowledge: knowledge.data,
      });
      setAnswer(
        reply.links?.length
          ? reply
          : { ...reply, links: linksFromText(reply.reply, knowledge.data) },
      );
    } catch (error) {
      toast.error('Không thử được bot', getApiErrorMessage(error));
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <form onSubmit={(event) => void ask(event)} className="flex flex-col gap-3">
      <Input
        label="Câu hỏi thử"
        name="playground-question"
        value={question}
        maxLength={300}
        onChange={(event) => setQuestion(event.target.value)}
        hint="Dùng cài đặt đang sửa (chưa cần lưu). Khách thử nghiệm không có đơn hàng."
      />
      <div className="flex flex-wrap gap-1.5">
        {PLAYGROUND_SAMPLES.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => setQuestion(sample)}
            className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-text-muted transition hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            {sample}
          </button>
        ))}
      </div>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="self-start"
        isLoading={isAsking}
        disabled={!knowledge.data}
        leftIcon={<FlaskConical size={15} aria-hidden="true" />}
      >
        Hỏi thử
      </Button>
      {knowledge.error && <p className="text-xs text-danger">{knowledge.error}</p>}
      {answer && (
        <div className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/6 p-3.5">
          <p className="text-sm whitespace-pre-line text-text">{answer.reply}</p>
          {(answer.links?.length || answer.quickReplies?.length) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {answer.links?.map((link) => (
                <a
                  key={link.to}
                  href={link.to}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-accent-cyan/30 bg-surface-2 px-2 py-1 text-[11px] font-medium text-accent-cyan hover:underline"
                >
                  {link.label}
                </a>
              ))}
              {answer.quickReplies?.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/12 px-2 py-1 text-[11px] text-text-muted"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-text-muted">
            <span>
              Nguồn:{' '}
              {answer.source === 'gemini'
                ? `Gemini AI${answer.model ? ` (${answer.model})` : ''}`
                : 'bộ trả lời theo từ khoá'}
            </span>
            <span className={answer.handoff ? 'text-accent-pink' : 'text-success'}>
              {answer.handoff ? 'Sẽ chuyển cho nhân viên' : 'Bot tự giải quyết'}
            </span>
          </p>
          {answer.fallbackReason && (
            <p className="mt-1.5 text-[11px] text-warning">
              Chưa dùng được Gemini: {FALLBACK_REASON_TEXT[answer.fallbackReason].title}.
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function BotSettingsForm({ initial }: { initial: BotSettings }) {
  const [settings, setSettings] = useState<EditableBotSettings>(() => {
    const { updatedAt: _updatedAt, ...rest } = initial;
    return rest;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initial.updatedAt);

  const patch = (value: Partial<EditableBotSettings>): void =>
    setSettings((current) => ({ ...current, ...value }));
  const toggleTopic = (topic: BotTopicId): void =>
    patch({ topics: { ...settings.topics, [topic]: !settings.topics[topic] } });

  const save = async (): Promise<void> => {
    if (settings.greeting.trim().length < 5 || settings.handoffMessage.trim().length < 5) {
      toast.error('Chưa lưu được', 'Lời chào và câu chuyển nhân viên không được để trống.');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await updateBotSettings({
        ...settings,
        greeting: settings.greeting.trim(),
        handoffMessage: settings.handoffMessage.trim(),
        extraKnowledge: settings.extraKnowledge.trim(),
      });
      setSavedAt(saved.updatedAt);
      toast.success('Đã lưu cài đặt trợ lý AI');
    } catch (error) {
      toast.error('Không lưu được', getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = BOT_TOPIC_IDS.filter((topic) => settings.topics[topic]).length;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <Panel
          title="Trợ lý AI trả lời khách"
          description="Chạy bằng Google Gemini (gói miễn phí). Khoá API chỉ nằm trên server Vercel."
          actions={
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
              <span>{settings.enabled ? 'Đang bật' : 'Đang tắt'}</span>
              <input
                type="checkbox"
                role="switch"
                checked={settings.enabled}
                onChange={(event) => patch({ enabled: event.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative h-6 w-11 rounded-full bg-white/15 transition peer-checked:bg-accent-cyan peer-focus-visible:ring-2 peer-focus-visible:ring-accent-cyan/60 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
              />
            </label>
          }
        >
          <ConnectionStatus />
          {!settings.enabled && (
            <p className="mt-3 text-sm text-warning">
              Khi tắt, mọi tin nhắn của khách chuyển thẳng vào mục “Cần trả lời”.
            </p>
          )}
        </Panel>

        <Panel
          title={`Việc bot được tự giải quyết (${enabledCount}/${BOT_TOPIC_IDS.length})`}
          description="Bot chỉ được biết dữ liệu của những mục đang bật. Câu hỏi ngoài các mục này bot chuyển cho nhân viên."
        >
          <fieldset
            disabled={!settings.enabled}
            className="grid gap-2 disabled:opacity-50 sm:grid-cols-2"
          >
            <legend className="sr-only">Chủ đề bot được trả lời</legend>
            {BOT_TOPIC_IDS.map((topic) => {
              const meta = BOT_TOPIC_META[topic];
              const on = settings.topics[topic];
              return (
                <label
                  key={topic}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-3 transition',
                    on
                      ? 'border-accent-cyan/40 bg-accent-cyan/6'
                      : 'border-white/8 hover:border-white/20',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleTopic(topic)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#3FE3F5]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text">{meta.label}</span>
                    <span className="block text-xs text-text-muted">{meta.description}</span>
                    <span className="mt-1 block text-[11px] text-text-muted/80 italic">
                      {meta.example}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="mt-3 text-xs text-text-muted">
            Luôn chuyển nhân viên, dù bật mục nào: huỷ/sửa đơn, hoàn tiền, khiếu nại, giữ hàng, trả
            giá, thu mua hàng cũ, lỗi thanh toán, hoặc khi khách muốn gặp người thật.
          </p>
        </Panel>

        <Panel title="Lời thoại & ghi chú cho bot">
          <div className="flex flex-col gap-4">
            <Textarea
              label="Lời chào khi khách mở chat"
              name="bot-greeting"
              rows={2}
              className="min-h-20"
              maxLength={300}
              value={settings.greeting}
              onChange={(event) => patch({ greeting: event.target.value })}
            />
            <Textarea
              label="Câu báo khi chuyển cho nhân viên"
              name="bot-handoff"
              rows={2}
              className="min-h-20"
              maxLength={300}
              value={settings.handoffMessage}
              onChange={(event) => patch({ handoffMessage: event.target.value })}
            />
            <Textarea
              label="Ghi chú thêm cho bot"
              name="bot-knowledge"
              rows={4}
              maxLength={1_500}
              value={settings.extraKnowledge}
              hint={`${settings.extraKnowledge.length}/1500 · VD: khuyến mãi tuần này, lịch nghỉ lễ. Bot có thể nói lại nội dung này cho khách — đừng ghi thông tin nội bộ hay bí mật.`}
              onChange={(event) => patch({ extraKnowledge: event.target.value })}
            />
          </div>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <Panel title="Lưu cài đặt">
          <Button
            fullWidth
            isLoading={isSaving}
            leftIcon={<Save size={16} aria-hidden="true" />}
            onClick={() => void save()}
          >
            Lưu cài đặt bot
          </Button>
          <p className="mt-2 text-xs text-text-muted">Lưu lần cuối: {formatDateTime(savedAt)}</p>
        </Panel>
        <Panel title="Thử bot" description="Xem bot sẽ trả lời thế nào với cài đặt hiện tại">
          <BotPlayground settings={settings} />
        </Panel>
      </div>
    </div>
  );
}

function MembershipSettingsForm({ initial }: { initial: ShopSettings }) {
  const [amount, setAmount] = useState(String(initial.memberDepositAmount));
  const [bank, setBank] = useState(initial.bank);
  const [errors, setErrors] = useState<Partial<Record<'amount' | 'accountNumber', string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const parsed = Number(amount.replace(/[.\s₫]/g, ''));
    const accountNumber = bank.accountNumber.replace(/\s+/g, '');
    const nextErrors: typeof errors = {};
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 50_000_000) {
      nextErrors.amount = 'Nhập số tiền từ 0 đến 50.000.000.';
    }
    if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
      nextErrors.accountNumber = 'Số tài khoản chỉ gồm 6–20 chữ số.';
    }
    if (accountNumber && (!bank.bankName.trim() || !bank.accountHolder.trim())) {
      nextErrors.accountNumber = 'Điền đủ tên ngân hàng và chủ tài khoản.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const saved = {
        bankName: bank.bankName.trim(),
        accountNumber,
        accountHolder: bank.accountHolder.trim().toUpperCase(),
      };
      await updateShopSettings({ memberDepositAmount: parsed, bank: saved });
      // Hiện lại đúng giá trị đã lưu (bỏ dấu cách, tên chủ tài khoản viết hoa).
      setBank(saved);
      setAmount(String(parsed));
      toast.success('Đã lưu cài đặt thành viên & thanh toán');
    } catch (saveError) {
      toast.error('Không lưu được', getApiErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const preview = Number(amount.replace(/[.\s₫]/g, ''));
  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <Input
        label="Số tiền nạp để lên Lv2"
        name="member-deposit"
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={errors.amount}
        hint={
          Number.isFinite(preview) && preview > 0
            ? `${formatCurrency(preview)} · là một trong ba cách lên Lv2 (cùng với mua đủ ${PURCHASES_FOR_LV2} con hoặc admin duyệt).`
            : 'Đặt 0 nếu không muốn nhận cách nạp tiền.'
        }
      />
      <fieldset className="grid gap-3 rounded-xl border border-white/8 p-3.5 sm:grid-cols-3">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-text">
          <Landmark size={14} aria-hidden="true" /> Tài khoản nhận tiền của shop
        </legend>
        <Input
          label="Ngân hàng"
          name="bank-name"
          value={bank.bankName}
          maxLength={60}
          placeholder="VD: Vietcombank"
          onChange={(event) => setBank({ ...bank, bankName: event.target.value })}
        />
        <Input
          label="Số tài khoản"
          name="bank-account"
          inputMode="numeric"
          value={bank.accountNumber}
          maxLength={24}
          error={errors.accountNumber}
          onChange={(event) => setBank({ ...bank, accountNumber: event.target.value })}
        />
        <Input
          label="Chủ tài khoản"
          name="bank-holder"
          value={bank.accountHolder}
          maxLength={60}
          placeholder="VIẾT HOA KHÔNG DẤU"
          onChange={(event) => setBank({ ...bank, accountHolder: event.target.value })}
        />
        <p className="text-xs text-text-muted sm:col-span-3">
          Hiện cho khách ở trang xác nhận đơn chuyển khoản và mục “Hạng thành viên”. Để trống thì
          web nhắc khách nhắn shop để nhận số tài khoản.
        </p>
      </fieldset>
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        isLoading={isSaving}
        leftIcon={<Save size={15} aria-hidden="true" />}
      >
        Lưu
      </Button>
    </form>
  );
}

function ShopSettingsPanel() {
  const { data, error, reload } = useAsync(() => getShopSettings(), []);
  return (
    <Panel
      title="Thành viên & thanh toán"
      description="Số tiền nạp để lên Lv2 (được đấu giá) và tài khoản ngân hàng khách chuyển tiền vào."
    >
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <MembershipSettingsForm initial={data} />
      )}
    </Panel>
  );
}

type FeeField = 'feeAsia' | 'feeWorld' | 'usdRate';

function toAmount(value: string): number {
  return Number(value.replace(/[.,\s₫]/g, ''));
}

function CardSettingsForm({ initial }: { initial: ShopSettings }) {
  const [cardPayments, setCardPayments] = useState(initial.cardPayments);
  const [intlEnabled, setIntlEnabled] = useState(initial.international.enabled);
  const [values, setValues] = useState<Record<FeeField, string>>({
    feeAsia: String(initial.international.feeAsia),
    feeWorld: String(initial.international.feeWorld),
    usdRate: String(initial.international.usdRate),
  });
  const [errors, setErrors] = useState<Partial<Record<FeeField, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const international: InternationalShippingSettings = {
      enabled: cardPayments && intlEnabled,
      feeAsia: toAmount(values.feeAsia),
      feeWorld: toAmount(values.feeWorld),
      usdRate: toAmount(values.usdRate),
    };
    const nextErrors: typeof errors = {};
    (['feeAsia', 'feeWorld'] as const).forEach((field) => {
      const fee = international[field];
      if (!Number.isInteger(fee) || fee < 0 || fee > 20_000_000) {
        nextErrors[field] = 'Nhập số tiền từ 0 đến 20.000.000.';
      }
    });
    if (
      !Number.isInteger(international.usdRate) ||
      international.usdRate < 1_000 ||
      international.usdRate > 100_000
    ) {
      nextErrors.usdRate = 'Nhập tỉ giá từ 1.000 đến 100.000.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const saved = await updateShopSettings({ cardPayments, international });
      setIntlEnabled(saved.international.enabled);
      toast.success('Đã lưu cài đặt thẻ & giao quốc tế');
    } catch (saveError) {
      toast.error('Không lưu được', getApiErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const field = (name: FeeField, label: string, hint: string) => {
    const amount = toAmount(values[name]);
    return (
      <Input
        label={label}
        name={name}
        inputMode="numeric"
        value={values[name]}
        onChange={(event) => setValues({ ...values, [name]: event.target.value })}
        error={errors[name]}
        hint={Number.isFinite(amount) && amount > 0 ? `${formatCurrency(amount)} · ${hint}` : hint}
      />
    );
  };

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <Checkbox
        name="card-payments"
        checked={cardPayments}
        onChange={(event) => setCardPayments(event.target.checked)}
        label={
          <>
            <span className="font-semibold text-text">Nhận thẻ Visa / Mastercard / JCB</span>
            <span className="block text-xs">
              Khách nhập thẻ trên trang bảo mật của cổng thanh toán (3-D Secure), web không bao giờ
              thấy số thẻ. Hàng được giữ {CARD_HOLD_MINUTES} phút chờ khách trả; quá hạn đơn tự huỷ.
              {!cardPayments &&
                ' Tắt thẻ chỉ áp dụng cho đơn mới — đơn đã mở trang thẻ vẫn trả được tới hết giờ giữ hàng.'}
            </span>
          </>
        }
      />
      <Checkbox
        name="international-shipping"
        checked={cardPayments && intlEnabled}
        disabled={!cardPayments}
        onChange={(event) => setIntlEnabled(event.target.checked)}
        label={
          <>
            <span className="font-semibold text-text">Nhận đơn gửi ra nước ngoài</span>
            <span className="block text-xs">
              {cardPayments
                ? `Đơn quốc tế chỉ trả bằng thẻ. Giao dự kiến ${DELIVERY_ESTIMATE.international}; thuế nhập khẩu (nếu có) do người nhận trả.`
                : 'Cần bật nhận thẻ trước — đơn quốc tế chỉ trả bằng thẻ.'}
            </span>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {field('feeAsia', `Phí gửi ${ZONE_LABELS.asia}`, 'mỗi đơn')}
        {field('feeWorld', `Phí gửi ${ZONE_LABELS.world}`, 'mỗi đơn')}
        {field('usdRate', 'Tỉ giá: 1 USD =', 'đồng')}
      </div>
      <p className="text-xs text-text-muted">
        Tỉ giá chỉ để khách nước ngoài ước lượng số tiền (≈ USD). Thẻ vẫn bị trừ bằng tiền đồng,
        ngân hàng của khách tự quy đổi.
      </p>
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        isLoading={isSaving}
        leftIcon={<Save size={15} aria-hidden="true" />}
      >
        Lưu cài đặt thẻ
      </Button>
    </form>
  );
}

function CardSettingsPanel() {
  const { data, error, reload } = useAsync(() => getShopSettings(), []);
  return (
    <Panel
      title="Thẻ quốc tế & giao ra nước ngoài"
      description="Thanh toán thẻ cho khách trong và ngoài nước, phí gửi quốc tế theo vùng."
    >
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <CardSettingsForm initial={data} />
      )}
    </Panel>
  );
}

function DemoDataPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const reset = async (): Promise<void> => {
    setIsResetting(true);
    try {
      await resetDemoData();
      toast.success('Đã khôi phục dữ liệu mẫu');
      setIsOpen(false);
    } catch (error) {
      toast.error('Không khôi phục được', getApiErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Panel title="Dữ liệu demo" description="Chỉ có ở bản chạy thử, chưa nối backend.">
      <p className="text-sm text-text-muted">
        Feed, đơn, khách và tin nhắn đang lưu trong trình duyệt này. Khôi phục sẽ xoá mọi thay đổi
        và nạp lại bộ dữ liệu mẫu ban đầu.
      </p>
      <Button
        variant="danger"
        size="sm"
        className="mt-3"
        leftIcon={<RotateCcw size={15} aria-hidden="true" />}
        onClick={() => setIsOpen(true)}
      >
        Khôi phục dữ liệu mẫu
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Khôi phục dữ liệu mẫu?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Huỷ
            </Button>
            <Button variant="danger" isLoading={isResetting} onClick={() => void reset()}>
              Xoá thay đổi & khôi phục
            </Button>
          </div>
        }
      >
        Mọi feed, đơn bạn tạo, chỉnh sửa khách hàng và tin nhắn trong bản demo sẽ bị xoá. Ảnh đã tải
        lên vẫn nằm trong trình duyệt. Không thể hoàn tác.
      </Modal>
    </Panel>
  );
}

export default function SettingsPage() {
  const revision = useLiveRevision();
  const bot = useAsync(() => getBotSettings(), [revision], { keepPreviousData: true });

  return (
    <>
      <Seo
        title="Cài đặt"
        description="Cài đặt cửa hàng và trợ lý AI"
        path={ADMIN_ROUTES.settings}
        noIndex
      />
      <AdminPageHeader
        title="Cài đặt"
        description={
          <span className="flex items-center gap-1.5">
            <Bot size={15} className="text-accent-cyan" aria-hidden="true" />
            Chọn những việc đơn giản giao cho trợ lý AI; việc còn lại tự chuyển về hộp tin nhắn của
            bạn.
          </span>
        }
      />

      {bot.error && <ErrorBox message={bot.error} onRetry={bot.reload} />}
      {bot.data ? (
        <BotSettingsForm key={bot.data.updatedAt} initial={bot.data} />
      ) : (
        !bot.error && <Skeleton className="h-[480px] w-full rounded-2xl" />
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ShopSettingsPanel />
        <CardSettingsPanel />
        {USE_MOCK && <DemoDataPanel />}
      </div>
    </>
  );
}

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  LoaderCircle,
  PackageOpen,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  AdminFeed,
  AdminItem,
  BakuganAttribute,
  BakuganSeries,
  FeedLimitCheck,
  ProductCondition,
} from '@/types';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES, PRODUCT_CONDITIONS } from '@/types';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import { ATTRIBUTE_META, CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import { BAKUGAN_MODELS } from '@/mocks';
import {
  checkFeedLimit,
  createFeed,
  getAdminFeed,
  listLeftoverItems,
  suggestItemCodes,
  updateFeed,
  type FeedInput,
  type FeedItemInput,
} from '@/services/api/admin';
import { uploadImage, validateImageFile } from '@/services/api/imageStore';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/uiStore';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, Modal, RefImage, Skeleton } from '@/components/ui';
import { AdminPageHeader, ErrorBox, Panel } from '@/features/admin/adminUi';

/* ---------------- Trạng thái form ---------------- */

interface DraftItem {
  key: string;
  /** Con đã có (trong feed này hoặc lấy từ hàng tồn) */
  id?: string;
  sold?: boolean;
  fromLeftover?: boolean;
  name: string;
  code: string;
  price: string;
  attribute: BakuganAttribute | '';
  series: BakuganSeries | '';
  condition: ProductCondition;
  conditionNote: string;
  gPower: string;
  photo?: string;
}

let draftCounter = 0;
function newKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

function emptyItem(): DraftItem {
  return {
    key: newKey(),
    name: '',
    code: '',
    price: '',
    attribute: '',
    series: '',
    condition: 'like-new',
    conditionNote: '',
    gPower: '',
  };
}

function fromAdminItem(item: AdminItem, fromLeftover = false): DraftItem {
  return {
    key: newKey(),
    id: item.id,
    sold: item.status === 'sold',
    fromLeftover,
    name: item.name,
    code: item.code,
    price: String(item.price),
    attribute: item.attribute,
    series: item.series ?? '',
    condition: item.condition,
    conditionNote: item.conditionNote ?? '',
    gPower: item.gPower ? String(item.gPower) : '',
    photo: item.hasOwnPhoto ? item.image : undefined,
  };
}

/** "2026-09-27T20:00" theo giờ máy người dùng, cho ô datetime-local. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputClass =
  'h-10 w-full rounded-lg border border-white/10 bg-surface-2/80 px-3 text-sm text-text outline-none placeholder:text-text-muted/50 focus:border-accent-cyan';

const MODEL_BY_NAME = new Map(BAKUGAN_MODELS.map((model) => [model.name.toLowerCase(), model]));

/* ---------------- Ô tải ảnh ---------------- */

function useUploader() {
  const [busy, setBusy] = useState(0);
  const upload = async (files: readonly File[]): Promise<string[]> => {
    const refs: string[] = [];
    for (const file of files) {
      const problem = validateImageFile(file);
      if (problem) {
        toast.error(`Bỏ qua ${file.name}`, problem);
        continue;
      }
      setBusy((value) => value + 1);
      try {
        refs.push(await uploadImage(file));
      } catch (error) {
        toast.error(`Không tải được ${file.name}`, getApiErrorMessage(error));
      } finally {
        setBusy((value) => value - 1);
      }
    }
    return refs;
  };
  return { upload, isUploading: busy > 0 };
}

function ItemPhotoButton({
  photo,
  onChange,
  label,
}: {
  photo?: string;
  onChange: (ref: string | undefined) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading } = useUploader();

  const onFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const [ref] = await upload([file]);
    if (ref) onChange(ref);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onFile(event)}
      />
      {photo ? (
        <span className="relative">
          <RefImage
            src={photo}
            alt={label}
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-danger p-0.5 text-white"
            aria-label={`Bỏ ảnh riêng của ${label}`}
          >
            <X size={11} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/20 text-text-muted transition hover:border-accent-cyan hover:text-accent-cyan"
          aria-label={`Thêm ảnh riêng cho ${label}`}
          title="Ảnh riêng (tuỳ chọn)"
        >
          {isUploading ? <LoaderCircle size={15} className="animate-spin" /> : <Camera size={15} />}
        </button>
      )}
    </div>
  );
}

/* ---------------- Hộp xác nhận khi web đã đủ 30 feed ---------------- */

function FeedLimitModal({
  check,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  check: FeedLimitCheck | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (carryLeftovers: boolean) => void;
}) {
  const [carry, setCarry] = useState(true);
  const oldest = check?.oldest;
  return (
    <Modal
      isOpen={Boolean(oldest)}
      onClose={onCancel}
      title={`Web đã có ${check?.feedCount ?? 0}/${check?.limit ?? 30} feed`}
      description="Để đăng feed mới, cần xoá feed cũ nhất khỏi web."
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Chưa đăng
          </Button>
          <Button
            variant="danger"
            isLoading={isSubmitting}
            onClick={() => onConfirm(carry && (oldest?.leftovers.length ?? 0) > 0)}
          >
            Xoá feed #{oldest?.number} và đăng
          </Button>
        </div>
      }
    >
      {oldest && (
        <div className="space-y-3 text-sm text-text-muted">
          <p>
            Feed cũ nhất: <span className="font-semibold text-text">#{oldest.number}</span> —{' '}
            {oldest.title}
          </p>
          {oldest.leftovers.length === 0 ? (
            <p className="rounded-xl border border-success/35 bg-success/8 p-3 text-success">
              Feed này đã bán hết {oldest.itemCount}/{oldest.itemCount} con — xoá không mất hàng
              nào.
            </p>
          ) : (
            <div className="rounded-xl border border-warning/35 bg-warning/8 p-3">
              <p className="font-semibold text-warning">
                Đã bán {oldest.soldCount}/{oldest.itemCount} con — còn {oldest.leftovers.length} con
                chưa bán:
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {oldest.leftovers.map((item) => (
                  <li key={item.id}>
                    <span className="font-mono text-accent-cyan">{item.code}</span> {item.name} ·{' '}
                    {formatCurrency(item.price)}
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-text">
                <input
                  type="checkbox"
                  checked={carry}
                  onChange={(event) => setCarry(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent-cyan)]"
                />
                Đưa {oldest.leftovers.length} con này vào feed mới đang đăng (bỏ chọn thì chúng nằm
                ở Hàng tồn để đăng sau).
              </label>
            </div>
          )}
          <p className="text-xs">
            Lịch sử những con đã bán và đơn hàng của feed cũ vẫn được giữ lại.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Chọn hàng tồn ---------------- */

function LeftoverPicker({
  isOpen,
  onClose,
  exclude,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  exclude: ReadonlySet<string>;
  onPick: (items: AdminItem[]) => void;
}) {
  const { data, isLoading } = useAsync(() => listLeftoverItems(), [isOpen], { enabled: isOpen });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const items = (data ?? []).filter((item) => !exclude.has(item.id));

  const toggle = (id: string): void => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm từ hàng tồn"
      description="Những con chưa bán từ các feed đã gỡ khỏi web."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Đóng
          </Button>
          <Button
            disabled={picked.size === 0}
            onClick={() => {
              onPick(items.filter((item) => picked.has(item.id)));
              setPicked(new Set());
            }}
          >
            Thêm {picked.size} con
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Không còn hàng tồn nào.</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/8">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-white/4">
                <input
                  type="checkbox"
                  checked={picked.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 accent-[var(--color-accent-cyan)]"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-mono text-xs text-accent-cyan">{item.code}</span>{' '}
                  <span className="text-text">{item.name}</span>
                  <span className="block text-xs text-text-muted">
                    {CONDITION_LABELS[item.condition]}
                    {item.feedNumber && ` · từ feed #${item.feedNumber}`}
                  </span>
                </span>
                <span className="text-sm font-semibold text-gold">
                  {formatCurrency(item.price)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ---------------- Trang ---------------- */

interface FormState {
  title: string;
  caption: string;
  images: string[];
  opensMode: 'now' | 'scheduled';
  opensAt: string;
  lotCost: string;
  supplier: string;
  items: DraftItem[];
}

function initialState(feed?: AdminFeed): FormState {
  if (!feed) {
    return {
      title: '',
      caption: '',
      images: [],
      opensMode: 'now',
      opensAt: '',
      lotCost: '',
      supplier: '',
      items: [emptyItem()],
    };
  }
  return {
    title: feed.title,
    caption: feed.caption,
    images: [...feed.images],
    opensMode: 'scheduled',
    opensAt: toLocalInput(feed.opensAt),
    lotCost: feed.lotCost ? String(feed.lotCost) : '',
    supplier: feed.supplier ?? '',
    items: feed.items.map((item) => fromAdminItem(item)),
  };
}

function FeedForm({ feed }: { feed?: AdminFeed }) {
  const navigate = useNavigate();
  const isEdit = Boolean(feed);
  const [form, setForm] = useState<FormState>(() => initialState(feed));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitCheck, setLimitCheck] = useState<FeedLimitCheck | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading } = useUploader();
  const codes = useAsync(() => suggestItemCodes(40), []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const setItem = (key: string, patch: Partial<DraftItem>): void => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  // Mã gợi ý cho những con mới chưa tự nhập mã (mã thật do hệ thống cấp khi lưu).
  const suggestedCodes = new Map<string, string>();
  form.items
    .filter((item) => !item.id && !item.code.trim())
    .forEach((item, index) => {
      const code = codes.data?.[index];
      suggestedCodes.set(item.key, code ? `Tự cấp: ${code}` : 'Tự cấp');
    });

  const onImages = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const room = 6 - form.images.length;
    if (files.length > room) toast.info('Mỗi feed tối đa 6 ảnh', `Chỉ lấy ${room} ảnh đầu.`);
    const refs = await upload(files.slice(0, Math.max(0, room)));
    if (refs.length > 0)
      setForm((current) => ({ ...current, images: [...current.images, ...refs] }));
  };

  const onNameChange = (item: DraftItem, name: string): void => {
    const model = MODEL_BY_NAME.get(name.trim().toLowerCase());
    setItem(item.key, {
      name,
      // Chọn đúng tên mẫu quen thuộc thì tự điền hệ / dòng / G-Power nếu còn trống.
      ...(model && {
        attribute: item.attribute || model.attribute,
        series: item.series || model.series,
        gPower: item.gPower || String(model.gPower),
      }),
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = 'Tiêu đề cần ít nhất 3 ký tự.';
    if (form.images.length === 0) next.images = 'Thêm ít nhất một ảnh chụp lô hàng.';
    if (form.opensMode === 'scheduled' && !form.opensAt) next.opensAt = 'Chọn giờ mở bán.';
    if (form.items.length === 0) next.items = 'Feed cần ít nhất một con Bakugan.';
    form.items.forEach((item) => {
      if (item.name.trim().length < 2) next[`${item.key}.name`] = 'Nhập tên';
      const price = Number(item.price);
      if (!Number.isInteger(price) || price <= 0) next[`${item.key}.price`] = 'Giá';
      if (!item.attribute) next[`${item.key}.attribute`] = 'Chọn hệ';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const toInput = (): FeedInput => ({
    title: form.title,
    caption: form.caption,
    images: form.images,
    opensAt:
      form.opensMode === 'scheduled' && form.opensAt
        ? new Date(form.opensAt).toISOString()
        : isEdit
          ? new Date().toISOString()
          : undefined,
    lotCost: form.lotCost ? Number(form.lotCost) : undefined,
    supplier: form.supplier,
    items: form.items.map((item): FeedItemInput => ({
      id: item.id,
      name: item.name,
      code: item.code || undefined,
      price: Number(item.price),
      attribute: item.attribute as BakuganAttribute,
      series: item.series || undefined,
      condition: item.condition,
      conditionNote: item.conditionNote,
      gPower: item.gPower ? Number(item.gPower) : undefined,
      photo: item.photo,
    })),
  });

  const save = async (options?: { replaceFeedId?: string; carryLeftovers?: boolean }) => {
    setIsSubmitting(true);
    try {
      const saved = feed
        ? await updateFeed(feed.id, toInput())
        : await createFeed(toInput(), options);
      toast.success(
        isEdit ? `Đã lưu feed #${saved.number}` : `Đã đăng feed #${saved.number}`,
        `${saved.itemCount} con Bakugan.`,
      );
      setLimitCheck(null);
      navigate(ADMIN_ROUTES.feeds);
    } catch (error) {
      toast.error(isEdit ? 'Chưa lưu được feed' : 'Chưa đăng được feed', getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!validate()) {
      toast.error('Còn thông tin chưa đủ', 'Kiểm tra các ô được đánh dấu đỏ.');
      return;
    }
    if (!feed) {
      // Đăng feed thứ 31: hỏi xoá feed cũ nhất và xử lý hàng còn tồn trong đó.
      try {
        const check = await checkFeedLimit();
        if (check.oldest) {
          setLimitCheck(check);
          return;
        }
      } catch (error) {
        toast.error('Không kiểm tra được số feed', getApiErrorMessage(error));
        return;
      }
    }
    await save();
  };

  const existingIds = new Set(form.items.flatMap((item) => (item.id ? [item.id] : [])));
  const total = form.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel
            title="Ảnh chụp cả lô"
            description="Chụp tất cả các con bày ra như ảnh mẫu. Ảnh đầu tiên là ảnh bìa (tối đa 6 ảnh)."
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void onImages(event)}
            />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.images.map((image, index) => (
                <li
                  key={image}
                  className="relative overflow-hidden rounded-xl border border-white/10"
                >
                  <RefImage
                    src={image}
                    alt={`Ảnh lô ${index + 1}`}
                    width={320}
                    height={180}
                    className="aspect-video w-full object-cover"
                  />
                  {index === 0 ? (
                    <span className="absolute top-2 left-2 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold text-background">
                      ẢNH BÌA
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        set('images', [image, ...form.images.filter((ref) => ref !== image)])
                      }
                      className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-text"
                    >
                      <Star size={10} aria-hidden="true" />
                      Làm ảnh bìa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'images',
                        form.images.filter((ref) => ref !== image),
                      )
                    }
                    className="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-text hover:text-danger"
                    aria-label={`Bỏ ảnh ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
              {form.images.length < 6 && (
                <li>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      'flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-sm transition',
                      errors.images
                        ? 'border-danger/60 text-danger'
                        : 'border-white/15 text-text-muted hover:border-accent-cyan hover:text-accent-cyan',
                    )}
                  >
                    {isUploading ? (
                      <LoaderCircle size={20} className="animate-spin" />
                    ) : (
                      <ImagePlus size={20} />
                    )}
                    {isUploading ? 'Đang xử lý ảnh…' : 'Tải ảnh lên'}
                  </button>
                </li>
              )}
            </ul>
            {errors.images && <p className="mt-2 text-sm text-danger">{errors.images}</p>}
          </Panel>

          <Panel
            title={`Danh sách Bakugan (${form.items.length})`}
            description="Mỗi con là duy nhất: đặt tên, mã (bỏ trống để tự cấp), tình trạng và giá riêng."
            actions={
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<PackageOpen size={15} />}
                onClick={() => setPickerOpen(true)}
              >
                Thêm từ hàng tồn
              </Button>
            }
            bodyClassName="space-y-3"
          >
            <datalist id="bakugan-models">
              {BAKUGAN_MODELS.map((model) => (
                <option key={model.name} value={model.name} />
              ))}
            </datalist>
            {form.items.map((item, index) => {
              const err = (field: string): string | undefined => errors[`${item.key}.${field}`];
              const label = item.name || `Con thứ ${index + 1}`;
              return (
                <fieldset
                  key={item.key}
                  className={cn(
                    'rounded-xl border p-3',
                    item.sold ? 'border-danger/25 bg-danger/5' : 'border-white/8 bg-surface-2/40',
                  )}
                >
                  <legend className="flex items-center gap-2 px-1 text-xs font-semibold text-text-muted">
                    #{index + 1}
                    {item.sold && <span className="font-bold text-danger">SOLD</span>}
                    {item.fromLeftover && <span className="text-accent-cyan">từ hàng tồn</span>}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
                    <label className="lg:col-span-4">
                      <span className="sr-only">Tên {label}</span>
                      <input
                        value={item.name}
                        onChange={(event) => onNameChange(item, event.target.value)}
                        list="bakugan-models"
                        placeholder="Tên (VD: Dragonoid Chiến Binh Lửa)"
                        className={cn(inputClass, err('name') && 'border-danger/70')}
                      />
                    </label>
                    <label className="lg:col-span-2">
                      <span className="sr-only">Mã {label}</span>
                      <input
                        value={item.code}
                        onChange={(event) => setItem(item.key, { code: event.target.value })}
                        placeholder={suggestedCodes.get(item.key) ?? ''}
                        className={cn(inputClass, 'font-mono uppercase')}
                      />
                    </label>
                    <label className="lg:col-span-2">
                      <span className="sr-only">Hệ {label}</span>
                      <select
                        value={item.attribute}
                        onChange={(event) =>
                          setItem(item.key, {
                            attribute: event.target.value as BakuganAttribute | '',
                          })
                        }
                        className={cn(
                          inputClass,
                          'cursor-pointer',
                          err('attribute') && 'border-danger/70',
                        )}
                      >
                        <option value="">Hệ…</option>
                        {BAKUGAN_ATTRIBUTES.map((value) => (
                          <option key={value} value={value}>
                            {ATTRIBUTE_META[value].label} ({ATTRIBUTE_META[value].element})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="lg:col-span-2">
                      <span className="sr-only">Dòng {label}</span>
                      <select
                        value={item.series}
                        onChange={(event) =>
                          setItem(item.key, { series: event.target.value as BakuganSeries | '' })
                        }
                        className={cn(inputClass, 'cursor-pointer')}
                      >
                        <option value="">Dòng (không rõ)</option>
                        {BAKUGAN_SERIES.map((value) => (
                          <option key={value} value={value}>
                            {SERIES_META[value].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="lg:col-span-2">
                      <span className="sr-only">Giá {label}</span>
                      <input
                        value={item.price}
                        onChange={(event) =>
                          setItem(item.key, { price: event.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="Giá (₫)"
                        disabled={item.sold}
                        className={cn(
                          inputClass,
                          'text-right tabular-nums',
                          err('price') && 'border-danger/70',
                        )}
                      />
                    </label>
                    <label className="lg:col-span-3">
                      <span className="sr-only">Tình trạng {label}</span>
                      <select
                        value={item.condition}
                        onChange={(event) =>
                          setItem(item.key, { condition: event.target.value as ProductCondition })
                        }
                        className={cn(inputClass, 'cursor-pointer')}
                      >
                        {PRODUCT_CONDITIONS.map((value) => (
                          <option key={value} value={value}>
                            {CONDITION_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="sm:col-span-2 lg:col-span-5">
                      <span className="sr-only">Ghi chú tình trạng {label}</span>
                      <input
                        value={item.conditionNote}
                        onChange={(event) =>
                          setItem(item.key, { conditionNote: event.target.value })
                        }
                        placeholder="Tình trạng riêng: trầy nhẹ, bung mượt, thiếu thẻ…"
                        className={inputClass}
                      />
                    </label>
                    <label className="lg:col-span-2">
                      <span className="sr-only">G-Power {label}</span>
                      <input
                        value={item.gPower}
                        onChange={(event) =>
                          setItem(item.key, { gPower: event.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="G-Power"
                        className={cn(inputClass, 'tabular-nums')}
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2 lg:col-span-2">
                      <ItemPhotoButton
                        photo={item.photo}
                        label={label}
                        onChange={(photo) => setItem(item.key, { photo })}
                      />
                      <button
                        type="button"
                        disabled={item.sold}
                        onClick={() =>
                          set(
                            'items',
                            form.items.filter((entry) => entry.key !== item.key),
                          )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                        aria-label={`Bỏ ${label} khỏi feed`}
                        title={
                          item.sold
                            ? 'Con đã bán giữ lại trong feed'
                            : item.id
                              ? 'Bỏ khỏi feed (chuyển vào hàng tồn)'
                              : 'Bỏ dòng này'
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </fieldset>
              );
            })}
            {errors.items && <p className="text-sm text-danger">{errors.items}</p>}
            <Button
              variant="outline"
              leftIcon={<Plus size={16} />}
              onClick={() => set('items', [...form.items, emptyItem()])}
            >
              Thêm Bakugan
            </Button>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Thông tin feed" bodyClassName="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text">
                Tiêu đề <span className="text-accent-pink">*</span>
              </span>
              <input
                value={form.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="VD: Lô Battle Brawlers đời đầu — 12 con"
                className={cn(inputClass, 'h-11', errors.title && 'border-danger/70')}
              />
              {errors.title && (
                <span className="mt-1 block text-xs text-danger">{errors.title}</span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text">Mô tả</span>
              <textarea
                value={form.caption}
                onChange={(event) => set('caption', event.target.value)}
                rows={4}
                placeholder="Lô mới về, đã test bung và nam châm từng con. Chốt đơn trên web hoặc nhắn shop kèm mã…"
                className="w-full resize-y rounded-lg border border-white/10 bg-surface-2/80 px-3 py-2 text-sm text-text outline-none focus:border-accent-cyan"
              />
            </label>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-text">Giờ mở bán</legend>
              <div className="flex gap-2">
                {(['now', 'scheduled'] as const).map((mode) => (
                  <label
                    key={mode}
                    className={cn(
                      'flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition',
                      form.opensMode === mode
                        ? 'border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan'
                        : 'border-white/10 text-text-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="opens-mode"
                      value={mode}
                      checked={form.opensMode === mode}
                      onChange={() => set('opensMode', mode)}
                      className="sr-only"
                    />
                    {mode === 'now' ? 'Mở bán ngay' : 'Hẹn giờ'}
                  </label>
                ))}
              </div>
              {form.opensMode === 'scheduled' && (
                <input
                  type="datetime-local"
                  value={form.opensAt}
                  onChange={(event) => set('opensAt', event.target.value)}
                  aria-label="Giờ mở bán"
                  className={cn(inputClass, 'mt-2', errors.opensAt && 'border-danger/70')}
                />
              )}
              <p className="mt-1.5 text-xs text-text-muted">
                Trước giờ mở bán khách chỉ xem trước danh sách, chưa đặt được.
              </p>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-text-muted">
                  Giá nhập lô (₫)
                </span>
                <input
                  value={form.lotCost}
                  onChange={(event) => set('lotCost', event.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="Tuỳ chọn"
                  className={cn(inputClass, 'tabular-nums')}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-text-muted">Nguồn hàng</span>
                <input
                  value={form.supplier}
                  onChange={(event) => set('supplier', event.target.value)}
                  placeholder="Tuỳ chọn"
                  className={inputClass}
                />
              </label>
            </div>
            <p className="text-[11px] text-text-muted">
              Giá nhập & nguồn hàng chỉ admin thấy — dùng để tính lãi từng feed.
            </p>
          </Panel>

          <Panel bodyClassName="space-y-3">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Số con</dt>
                <dd className="font-semibold text-text">{form.items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Tổng giá bán</dt>
                <dd className="font-semibold text-gold">{formatCurrency(total)}</dd>
              </div>
            </dl>
            {Object.keys(errors).length > 0 && (
              <p className="flex items-start gap-2 text-xs text-danger">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                Còn {Object.keys(errors).length} ô chưa hợp lệ.
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              disabled={isUploading}
            >
              {isEdit ? 'Lưu thay đổi' : 'Đăng feed'}
            </Button>
            {feed && (
              <Link
                to={ROUTES.feedDetail(feed.number)}
                target="_blank"
                className="block text-center text-xs font-semibold text-accent-cyan hover:underline"
              >
                Xem feed #{feed.number} trên web
              </Link>
            )}
          </Panel>
        </div>
      </div>

      <FeedLimitModal
        check={limitCheck}
        isSubmitting={isSubmitting}
        onCancel={() => setLimitCheck(null)}
        onConfirm={(carryLeftovers) =>
          void save({ replaceFeedId: limitCheck?.oldest?.id, carryLeftovers })
        }
      />
      <LeftoverPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exclude={existingIds}
        onPick={(items) => {
          setForm((current) => ({
            ...current,
            // Bỏ dòng trống đầu tiên nếu admin chưa nhập gì.
            items: [
              ...current.items.filter((item) => item.id || item.name.trim() || item.price),
              ...items.map((item) => fromAdminItem(item, true)),
            ],
          }));
          setPickerOpen(false);
          toast.success(`Đã thêm ${items.length} con từ hàng tồn`);
        }}
      />
    </form>
  );
}

export default function FeedEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, reload } = useAsync(() => getAdminFeed(id ?? ''), [id], {
    enabled: Boolean(id),
  });

  return (
    <>
      <Link
        to={ADMIN_ROUTES.feeds}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted transition hover:text-accent-cyan"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Danh sách feed
      </Link>
      <AdminPageHeader
        title={id ? (data ? `Sửa feed #${data.number}` : 'Sửa feed') : 'Đăng feed mới'}
        description={
          id
            ? 'Sửa ảnh, thông tin và danh sách Bakugan. Con đã bán được giữ nguyên giá để khớp lịch sử đơn.'
            : 'Đăng một lô Bakugan: ảnh chụp cả lô, rồi từng con với tên và mã riêng.'
        }
      />
      {id ? (
        error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : isLoading || !data ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : (
          <FeedForm key={data.id} feed={data} />
        )
      ) : (
        <FeedForm />
      )}
    </>
  );
}

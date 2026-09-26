import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Gavel,
  RotateCcw,
  TriangleAlert,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { CancelReason, IssueType, Order, OrderIssue, OrderStatus } from '@/types';
import { CANCEL_REASONS, ISSUE_TYPES } from '@/types';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import {
  CANCEL_REASON_LABELS,
  ISSUE_TYPE_LABELS,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
} from '@/constants/orders';
import {
  createIssue,
  getOrder,
  listIssuesForOrder,
  updateOrderNote,
  updateOrderStatus,
  updatePaymentStatus,
} from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, Checkbox, Modal, Seo, Skeleton, Textarea } from '@/components/ui';
import {
  AdminPageHeader,
  ErrorBox,
  InfoRow,
  IssueStatusBadge,
  OrderStatusBadge,
  Panel,
} from '@/features/admin/adminUi';

/** Lời nhắc cho từng bước chuyển trạng thái. */
const ACTION_COPY: Partial<Record<OrderStatus, { label: string; hint: string }>> = {
  confirmed: { label: 'Xác nhận đơn', hint: 'Đã liên hệ khách và chốt đơn.' },
  packing: { label: 'Bắt đầu đóng gói', hint: 'Lấy hàng khỏi kệ, kiểm tra và đóng gói.' },
  shipping: { label: 'Giao cho vận chuyển', hint: 'Ghi mã vận đơn vào ghi chú nếu có.' },
  completed: { label: 'Khách đã nhận', hint: 'Đơn COD sẽ tự chuyển sang "Đã thanh toán".' },
  cancelled: { label: 'Huỷ đơn', hint: 'Hàng được trả lại kho.' },
  returned: { label: 'Khách hoàn hàng', hint: 'Chọn có nhập lại kho hay không.' },
};

function StatusActions({ order }: { order: Order }) {
  const next = ORDER_TRANSITIONS[order.status];
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [dialog, setDialog] = useState<'cancelled' | 'returned' | null>(null);
  const [reason, setReason] = useState<CancelReason>('customer-request');
  const [restock, setRestock] = useState(true);

  const submit = async (status: OrderStatus): Promise<void> => {
    setPending(status);
    try {
      await updateOrderStatus(order.id, {
        status,
        note,
        cancelReason: status === 'cancelled' ? reason : undefined,
        restock: status === 'returned' ? restock : undefined,
      });
      toast.success(`Đã chuyển sang "${ORDER_STATUS_LABELS[status]}"`, `Đơn #${order.code}`);
      setNote('');
      setDialog(null);
    } catch (error) {
      toast.error('Không cập nhật được đơn', getApiErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  if (next.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Đơn đã ở trạng thái cuối ({ORDER_STATUS_LABELS[order.status].toLowerCase()}), không còn bước
        xử lý nào.
      </p>
    );
  }

  const forward = next.filter((status) => status !== 'cancelled' && status !== 'returned');
  const exits = next.filter((status) => status === 'cancelled' || status === 'returned') as Array<
    'cancelled' | 'returned'
  >;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="Ghi chú cho bước này (tuỳ chọn)"
        name="status-note"
        rows={2}
        className="min-h-20 text-sm"
        placeholder="VD: mã vận đơn, người nhận thay…"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={300}
      />
      {forward.map((status) => (
        <Button
          key={status}
          fullWidth
          isLoading={pending === status}
          leftIcon={<CheckCircle2 size={16} aria-hidden="true" />}
          onClick={() => void submit(status)}
        >
          {ACTION_COPY[status]?.label ?? ORDER_STATUS_LABELS[status]}
        </Button>
      ))}
      {forward[0] && ACTION_COPY[forward[0]] && (
        <p className="-mt-1 text-xs text-text-muted">{ACTION_COPY[forward[0]]!.hint}</p>
      )}
      {exits.map((status) => (
        <Button
          key={status}
          variant="danger"
          fullWidth
          leftIcon={
            status === 'cancelled' ? (
              <XCircle size={16} aria-hidden="true" />
            ) : (
              <RotateCcw size={16} aria-hidden="true" />
            )
          }
          onClick={() => setDialog(status)}
        >
          {ACTION_COPY[status]?.label}
        </Button>
      ))}

      <Modal
        isOpen={dialog === 'cancelled'}
        onClose={() => setDialog(null)}
        title={`Huỷ đơn #${order.code}`}
        description="Hàng trong đơn sẽ được trả lại tồn kho. Lý do huỷ được đưa vào báo cáo."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Giữ đơn
            </Button>
            <Button
              variant="danger"
              isLoading={pending === 'cancelled'}
              onClick={() => void submit('cancelled')}
            >
              Xác nhận huỷ
            </Button>
          </div>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-text">Lý do huỷ</legend>
          {CANCEL_REASONS.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="cancel-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="h-4 w-4 accent-[#E940D2]"
              />
              {CANCEL_REASON_LABELS[value]}
            </label>
          ))}
        </fieldset>
        {order.paymentStatus === 'paid' && (
          <p className="mt-4 rounded-xl border border-warning/30 bg-warning/8 p-3 text-xs text-warning">
            Khách đã thanh toán — sau khi huỷ, nhớ hoàn tiền và bấm “Đã hoàn tiền”.
          </p>
        )}
      </Modal>

      <Modal
        isOpen={dialog === 'returned'}
        onClose={() => setDialog(null)}
        title={`Ghi nhận hoàn hàng #${order.code}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Đóng
            </Button>
            <Button
              variant="danger"
              isLoading={pending === 'returned'}
              onClick={() => void submit('returned')}
            >
              Xác nhận hoàn hàng
            </Button>
          </div>
        }
      >
        <Checkbox
          label="Hàng còn nguyên vẹn — nhập lại vào kho để bán tiếp"
          name="restock"
          checked={restock}
          onChange={(event) => setRestock(event.target.checked)}
        />
      </Modal>
    </div>
  );
}

function PaymentPanel({ order }: { order: Order }) {
  const [isSaving, setIsSaving] = useState(false);
  const needsRefund =
    order.paymentStatus === 'paid' && (order.status === 'cancelled' || order.status === 'returned');

  const setPayment = async (value: Order['paymentStatus']): Promise<void> => {
    setIsSaving(true);
    try {
      await updatePaymentStatus(order.id, value);
      toast.success(`Đã cập nhật: ${PAYMENT_STATUS_LABELS[value].toLowerCase()}`);
    } catch (error) {
      toast.error('Không cập nhật được thanh toán', getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Panel title="Thanh toán">
      <dl>
        <InfoRow label="Hình thức">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</InfoRow>
        <InfoRow label="Tình trạng">
          <span className={cn('font-semibold', PAYMENT_STATUS_STYLES[order.paymentStatus])}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
        </InfoRow>
      </dl>
      {needsRefund && (
        <p className="mt-3 flex gap-2 rounded-xl border border-warning/30 bg-warning/8 p-3 text-xs text-warning">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Đơn đã huỷ/hoàn nhưng khách đã trả tiền — cần hoàn tiền. Số tài khoản của khách được hệ
          thống thanh toán giữ kín, nhân viên không xem được.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && (
          <Button
            variant="outline"
            size="sm"
            isLoading={isSaving}
            leftIcon={<CircleDollarSign size={15} aria-hidden="true" />}
            onClick={() => void setPayment('paid')}
          >
            Xác nhận đã nhận tiền
          </Button>
        )}
        {needsRefund && (
          <Button
            variant="gold"
            size="sm"
            isLoading={isSaving}
            onClick={() => void setPayment('refunded')}
          >
            Đã hoàn tiền cho khách
          </Button>
        )}
      </div>
    </Panel>
  );
}

function NotePanel({ order }: { order: Order }) {
  const [note, setNote] = useState(order.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const dirty = note.trim() !== (order.note ?? '');

  const save = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await updateOrderNote(order.id, note);
      toast.success('Đã lưu ghi chú nội bộ');
    } catch (error) {
      toast.error('Không lưu được ghi chú', getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Panel title="Ghi chú nội bộ" description="Chỉ nhân viên thấy, khách không thấy.">
      <Textarea
        label="Ghi chú"
        name="internal-note"
        rows={3}
        className="min-h-24 text-sm"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        size="sm"
        variant="secondary"
        className="mt-3"
        disabled={!dirty}
        isLoading={isSaving}
        onClick={() => void save()}
      >
        Lưu ghi chú
      </Button>
    </Panel>
  );
}

function IssuesPanel({ order, issues }: { order: Order; issues: OrderIssue[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<IssueType>('late-delivery');
  const [reportedBy, setReportedBy] = useState<OrderIssue['reportedBy']>('customer');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string>();

  const submit = async (): Promise<void> => {
    if (description.trim().length < 10) {
      setDescriptionError('Mô tả ít nhất 10 ký tự để người xử lý hiểu chuyện gì đã xảy ra.');
      return;
    }
    setIsSaving(true);
    try {
      await createIssue({ orderId: order.id, type, description, reportedBy });
      toast.success('Đã ghi nhận sự cố', ISSUE_TYPE_LABELS[type]);
      setIsOpen(false);
      setDescription('');
      setDescriptionError(undefined);
    } catch (error) {
      toast.error('Không ghi nhận được sự cố', getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Panel
      title="Sự cố"
      actions={
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(true)}>
          Báo sự cố
        </Button>
      }
    >
      {issues.length === 0 ? (
        <p className="text-sm text-text-muted">Chưa có sự cố nào với đơn này.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-xl border border-white/8 bg-surface-2/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text">
                  {ISSUE_TYPE_LABELS[issue.type]}
                </span>
                <IssueStatusBadge status={issue.status} />
              </div>
              <p className="mt-1 text-xs text-text-muted">{issue.description}</p>
              {issue.resolution && (
                <p className="mt-1 text-xs text-success">Đã xử lý: {issue.resolution}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        to={ADMIN_ROUTES.problems}
        className="mt-3 inline-block text-xs font-medium text-accent-cyan hover:underline"
      >
        Mở báo cáo sự cố
      </Link>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Báo sự cố đơn #${order.code}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Đóng
            </Button>
            <Button isLoading={isSaving} onClick={() => void submit()}>
              Ghi nhận
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
            Loại sự cố
            <select
              value={type}
              onChange={(event) => setType(event.target.value as IssueType)}
              className="h-11 rounded-xl border border-white/10 bg-surface-2 px-3 text-sm font-normal text-text"
            >
              {ISSUE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {ISSUE_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
            Ai báo
            <select
              value={reportedBy}
              onChange={(event) => setReportedBy(event.target.value as OrderIssue['reportedBy'])}
              className="h-11 rounded-xl border border-white/10 bg-surface-2 px-3 text-sm font-normal text-text"
            >
              <option value="customer">Khách hàng</option>
              <option value="carrier">Đơn vị vận chuyển</option>
              <option value="admin">Nhân viên shop</option>
            </select>
          </label>
          <Textarea
            label="Mô tả"
            name="issue-description"
            required
            rows={3}
            className="min-h-24 text-sm"
            value={description}
            error={descriptionError}
            maxLength={600}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </Modal>
    </Panel>
  );
}

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const revision = useLiveRevision();
  const {
    data: order,
    error,
    reload,
  } = useAsync(() => getOrder(id), [id, revision], {
    keepPreviousData: true,
  });
  const { data: issues } = useAsync(() => listIssuesForOrder(id), [id, revision], {
    keepPreviousData: true,
  });

  if (error && !order) {
    return (
      <>
        <Link
          to={ADMIN_ROUTES.orders}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Danh sách đơn
        </Link>
        <ErrorBox message={error} onRetry={reload} />
      </>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-96 xl:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo title={`Đơn #${order.code}`} description="Chi tiết đơn hàng" noIndex />
      <Link
        to={ADMIN_ROUTES.orders}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Danh sách đơn
      </Link>

      <AdminPageHeader
        title={`Đơn #${order.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span>
              {ORDER_SOURCE_LABELS[order.source]} · đặt lúc {formatDateTime(order.createdAt)}
            </span>
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Panel title={`Sản phẩm (${order.items.length})`} bodyClassName="p-0">
            <ul className="divide-y divide-white/5">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 px-5 py-3">
                  <img
                    src={item.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{item.name}</p>
                    <p className="text-xs text-text-muted">
                      {formatCurrency(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-text tabular-nums">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-white/8 px-5 py-4 text-sm">
              <div className="flex justify-between text-text-muted">
                <dt>Tạm tính</dt>
                <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-text-muted">
                <dt>Phí vận chuyển</dt>
                <dd className="tabular-nums">
                  {order.shippingFee === 0 ? 'Miễn phí' : formatCurrency(order.shippingFee)}
                </dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Giảm giá</dt>
                  <dd className="tabular-nums">−{formatCurrency(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-white/8 pt-2 text-base font-bold text-text">
                <dt>Tổng cộng</dt>
                <dd className="tabular-nums">{formatCurrency(order.total)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Lịch sử xử lý">
            <ol className="relative ml-2 border-l border-white/10">
              {[...order.timeline].reverse().map((event, index) => (
                <li key={event.id} className="relative pb-5 pl-5 last:pb-0">
                  <span
                    className={cn(
                      'absolute top-1 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-surface',
                      index === 0 ? 'bg-accent-cyan' : 'bg-white/25',
                    )}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-text">
                    {ORDER_STATUS_LABELS[event.status]}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDateTime(event.at)} · {event.actor}
                  </p>
                  {event.note && <p className="mt-1 text-sm text-text-muted">{event.note}</p>}
                </li>
              ))}
            </ol>
            {order.cancelReason && (
              <p className="mt-4 rounded-xl border border-white/10 bg-surface-2/60 p-3 text-sm text-text-muted">
                Lý do huỷ:{' '}
                <span className="font-semibold text-text">
                  {CANCEL_REASON_LABELS[order.cancelReason]}
                </span>
                {order.cancelNote ? ` — ${order.cancelNote}` : ''}
              </p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Xử lý đơn">
            <StatusActions order={order} />
          </Panel>

          <Panel title="Người nhận">
            <dl>
              <InfoRow label="Họ tên">{order.receiverName}</InfoRow>
              <InfoRow label="Điện thoại">
                <a href={`tel:${order.phone}`} className="text-accent-cyan hover:underline">
                  {order.phone}
                </a>
              </InfoRow>
              {order.customerEmail && <InfoRow label="Email">{order.customerEmail}</InfoRow>}
              <InfoRow label="Địa chỉ">{order.addressLine}</InfoRow>
            </dl>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {order.userId ? (
                <Link
                  to={ADMIN_ROUTES.customerDetail(order.userId)}
                  className="inline-flex items-center gap-1.5 font-medium text-accent-cyan hover:underline"
                >
                  <UserRound size={14} aria-hidden="true" /> Hồ sơ khách hàng
                </Link>
              ) : (
                <span className="text-text-muted">Khách lẻ, không có tài khoản</span>
              )}
              {order.auctionId && (
                <Link
                  to={ROUTES.auctionDetail(order.auctionId)}
                  className="inline-flex items-center gap-1.5 font-medium text-accent-cyan hover:underline"
                >
                  <Gavel size={14} aria-hidden="true" /> Phiên đấu giá
                </Link>
              )}
            </div>
          </Panel>

          <PaymentPanel order={order} />
          <IssuesPanel order={order} issues={issues ?? []} />
          <NotePanel key={order.note ?? ''} order={order} />
        </div>
      </div>
    </>
  );
}

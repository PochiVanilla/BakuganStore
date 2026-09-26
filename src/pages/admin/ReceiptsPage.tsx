import { Fragment, useState } from 'react';
import { ChevronDown, Download, PackagePlus } from 'lucide-react';
import { BAKUGAN_ATTRIBUTES } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ATTRIBUTE_META } from '@/constants/catalog';
import { getReceiptReport, listProductOptions } from '@/services/api/admin';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
import { AttributeIcon, Button, EmptyState, Seo, Skeleton } from '@/components/ui';
import {
  AdminPageHeader,
  CompactSelect,
  ErrorBox,
  Panel,
  StatCard,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';
import { BarList, ColumnChart } from '@/features/admin/charts';
import { formatAxisMoney, formatMonthLabel } from '@/features/admin/adminFormat';
import { ReceiptFormModal } from '@/features/admin/ReceiptFormModal';

const RANGE_OPTIONS = [
  { value: '30', label: '30 ngày qua' },
  { value: '90', label: '90 ngày qua' },
  { value: '180', label: '6 tháng qua' },
  { value: '365', label: '12 tháng qua' },
] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number]['value'];

export default function ReceiptsPage() {
  const revision = useLiveRevision();
  const [range, setRange] = useState<RangeOption>('90');
  const [supplier, setSupplier] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formKey, setFormKey] = useState<string | null>(null);

  const report = useAsync(
    () => getReceiptReport({ days: Number(range), supplier }),
    [range, supplier, revision],
    { keepPreviousData: true },
  );
  const products = useAsync(() => listProductOptions(), [revision], { keepPreviousData: true });
  const data = report.data;

  const exportCsv = (): void => {
    if (!data) return;
    const rows = data.receipts.flatMap((receipt) =>
      receipt.items.map((item) => [
        receipt.code,
        formatDate(receipt.receivedAt),
        receipt.supplier,
        item.productName,
        ATTRIBUTE_META[item.attribute].label,
        item.quantity,
        item.unitCost,
        item.quantity * item.unitCost,
        receipt.createdBy,
      ]),
    );
    downloadCsv(
      `bao-cao-nhap-hang-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Số phiếu',
        'Ngày nhập',
        'Nhà cung cấp',
        'Sản phẩm',
        'Hệ',
        'Số lượng',
        'Giá vốn',
        'Thành tiền',
        'Người lập',
      ],
      rows,
    );
  };

  const supplierOptions = [
    { value: '', label: 'Mọi nhà cung cấp' },
    ...(data?.suppliers ?? []).map((name) => ({ value: name, label: name })),
  ];

  return (
    <>
      <Seo
        title="Nhập hàng"
        description="Phiếu nhập và báo cáo nhập hàng"
        path={ADMIN_ROUTES.receipts}
        noIndex
      />
      <AdminPageHeader
        title="Nhập hàng"
        description="Lập phiếu nhập để cộng tồn kho và theo dõi chi phí nhập theo tháng, nhà cung cấp, hệ."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={!data || data.receipts.length === 0}
              leftIcon={<Download size={15} aria-hidden="true" />}
              onClick={exportCsv}
            >
              Xuất báo cáo CSV
            </Button>
            <Button
              size="sm"
              disabled={!products.data}
              leftIcon={<PackagePlus size={15} aria-hidden="true" />}
              onClick={() => setFormKey(String(Date.now()))}
            >
              Lập phiếu nhập
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <CompactSelect
          label="Khoảng thời gian"
          value={range}
          onChange={setRange}
          options={RANGE_OPTIONS}
          className="sm:w-48"
        />
        <CompactSelect
          label="Nhà cung cấp"
          value={supplier}
          onChange={setSupplier}
          options={supplierOptions}
          className="sm:w-64"
        />
      </div>

      {report.error && <ErrorBox message={report.error} onRetry={report.reload} />}

      <div
        className={cn(
          'grid grid-cols-2 gap-3 xl:grid-cols-4',
          report.isLoading && data && 'opacity-60',
        )}
      >
        {data ? (
          <>
            <StatCard label="Tổng tiền nhập" value={formatCurrency(data.totalCost)} />
            <StatCard label="Số Bakugan nhập" value={formatNumber(data.totalQuantity)} />
            <StatCard label="Số phiếu nhập" value={data.receipts.length} />
            <StatCard
              label="Giá vốn trung bình / con"
              value={
                data.totalQuantity > 0
                  ? formatCurrency(Math.round(data.totalCost / data.totalQuantity))
                  : '—'
              }
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-2xl" />
          ))
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Chi phí nhập theo tháng">
          {data ? (
            data.byMonth.length > 0 ? (
              <ColumnChart
                caption="Chi phí nhập hàng theo tháng"
                categoryLabel="Tháng"
                height={180}
                data={data.byMonth.map((entry) => ({
                  key: entry.month,
                  label: formatMonthLabel(entry.month).replace(/\/\d{4}$/, ''),
                  fullLabel: formatMonthLabel(entry.month),
                  value: entry.cost,
                  detail: `${entry.quantity} con`,
                }))}
                formatValue={formatCurrency}
                formatTick={formatAxisMoney}
              />
            ) : (
              <p className="py-10 text-center text-sm text-text-muted">
                Chưa có phiếu nhập trong kỳ.
              </p>
            )
          ) : (
            <Skeleton className="h-52 w-full" />
          )}
        </Panel>
        <Panel title="Theo nhà cung cấp" description="Tổng tiền nhập">
          {data ? (
            <BarList
              caption="Chi phí nhập theo nhà cung cấp"
              data={data.bySupplier.map((entry) => ({
                key: entry.supplier,
                label: entry.supplier,
                textLabel: entry.supplier,
                value: entry.cost,
                display: formatAxisMoney(entry.cost),
              }))}
            />
          ) : (
            <Skeleton className="h-52 w-full" />
          )}
        </Panel>
        <Panel title="Theo hệ" description="Số con đã nhập">
          {data ? (
            <BarList
              caption="Số Bakugan nhập theo hệ"
              data={BAKUGAN_ATTRIBUTES.map((value) => ({
                key: value,
                textLabel: ATTRIBUTE_META[value].label,
                label: (
                  <span className="flex items-center gap-1.5">
                    <AttributeIcon attribute={value} size={14} />
                    {ATTRIBUTE_META[value].label}
                  </span>
                ),
                value: data.byAttribute[value],
                display: `${data.byAttribute[value]} con`,
              }))}
            />
          ) : (
            <Skeleton className="h-52 w-full" />
          )}
        </Panel>
      </div>

      <Panel title="Phiếu nhập" className="mt-4" bodyClassName="p-0">
        {!data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : data.receipts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<PackagePlus size={26} aria-hidden="true" />}
              title="Chưa có phiếu nhập trong kỳ này"
            />
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <th className={th}>Số phiếu</th>
                <th className={th}>Ngày nhập</th>
                <th className={th}>Nhà cung cấp</th>
                <th className={cn(th, 'text-right')}>Số lượng</th>
                <th className={cn(th, 'text-right')}>Thành tiền</th>
                <th className={th}>Người lập</th>
                <th className={th}>
                  <span className="sr-only">Chi tiết</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.receipts.map((receipt) => {
                const isOpen = expanded === receipt.id;
                return (
                  <Fragment key={receipt.id}>
                    <tr className="transition hover:bg-white/3">
                      <td className={cn(td, 'font-mono font-semibold')}>{receipt.code}</td>
                      <td className={cn(td, 'text-text-muted')}>
                        {formatDate(receipt.receivedAt)}
                      </td>
                      <td className={td}>{receipt.supplier}</td>
                      <td className={cn(td, 'text-right tabular-nums')}>{receipt.totalQuantity}</td>
                      <td className={cn(td, 'text-right font-semibold tabular-nums')}>
                        {formatCurrency(receipt.totalCost)}
                      </td>
                      <td className={cn(td, 'text-xs text-text-muted')}>{receipt.createdBy}</td>
                      <td className={cn(td, 'text-right')}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : receipt.id)}
                          aria-expanded={isOpen}
                          aria-controls={`receipt-${receipt.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-accent-cyan hover:bg-white/5"
                        >
                          {isOpen ? 'Thu gọn' : `${receipt.items.length} dòng`}
                          <ChevronDown
                            size={14}
                            className={cn('transition', isOpen && 'rotate-180')}
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={`receipt-${receipt.id}`}>
                        <td
                          colSpan={7}
                          className="border-b border-white/5 bg-surface-2/40 px-4 py-3"
                        >
                          <ul className="flex flex-col gap-1.5">
                            {receipt.items.map((item) => (
                              <li
                                key={item.productId}
                                className="flex flex-wrap items-center gap-x-3 text-sm"
                              >
                                <AttributeIcon attribute={item.attribute} size={14} />
                                <span className="min-w-0 flex-1 text-text">{item.productName}</span>
                                <span className="text-text-muted tabular-nums">
                                  {item.quantity} × {formatCurrency(item.unitCost)}
                                </span>
                                <span className="w-28 text-right font-medium tabular-nums">
                                  {formatCurrency(item.quantity * item.unitCost)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {receipt.note && (
                            <p className="mt-2 text-xs text-text-muted">Ghi chú: {receipt.note}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Panel>

      {formKey && products.data && (
        <ReceiptFormModal
          key={formKey}
          isOpen
          onClose={() => setFormKey(null)}
          products={products.data}
          suppliers={data?.suppliers ?? []}
        />
      )}
    </>
  );
}

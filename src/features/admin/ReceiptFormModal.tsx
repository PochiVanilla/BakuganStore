import { useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import type { Product } from '@/types';
import { createReceipt } from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { receiptSchema, type ReceiptFormValues } from './schemas';

const cellInput =
  'h-10 w-full rounded-lg border border-white/10 bg-surface-2/80 px-2.5 text-sm text-text outline-none focus:border-accent-cyan';

function todayInVietnam(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Giá vốn gợi ý: khoảng 55% giá bán, làm tròn nghìn. */
function suggestedCost(product?: Product): number {
  return product ? Math.round((product.price * 0.55) / 1_000) * 1_000 : 0;
}

export function ReceiptFormModal({
  isOpen,
  onClose,
  products,
  suppliers,
}: {
  isOpen: boolean;
  onClose: () => void;
  products: readonly Product[];
  suppliers: readonly string[];
}) {
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      supplier: '',
      receivedAt: todayInVietnam(),
      note: '',
      items: [{ productId: '', quantity: 1, unitCost: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const totalCost = items.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0),
    0,
  );

  const onSubmit = async (values: ReceiptFormValues): Promise<void> => {
    try {
      const receipt = await createReceipt({
        supplier: values.supplier,
        // Giữ đúng ngày đã chọn theo giờ Việt Nam.
        receivedAt: new Date(`${values.receivedAt}T09:00:00+07:00`).toISOString(),
        note: values.note,
        items: values.items,
      });
      toast.success(`Đã lập phiếu ${receipt.code}`, `Nhập ${receipt.totalQuantity} con vào kho`);
      onClose();
    } catch (error) {
      toast.error('Không lập được phiếu nhập', getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lập phiếu nhập kho"
      description="Tồn kho các mẫu được cộng ngay khi lưu phiếu."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            {totalQuantity} con ·{' '}
            <span className="font-semibold text-text">{formatCurrency(totalCost)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" form="receipt-form" isLoading={isSubmitting}>
              Lưu phiếu nhập
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="receipt-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nhà cung cấp"
            required
            list="receipt-suppliers"
            placeholder="VD: Đại lý Toys Sài Gòn"
            error={errors.supplier?.message}
            {...register('supplier')}
          />
          <datalist id="receipt-suppliers">
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier} />
            ))}
          </datalist>
          <Input
            label="Ngày nhập"
            type="date"
            required
            max={todayInVietnam()}
            error={errors.receivedAt?.message}
            {...register('receivedAt')}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text">Hàng nhập</legend>
          <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_8rem_2.5rem] gap-2 px-1 pb-1 text-xs text-text-muted sm:grid">
            <span>Sản phẩm</span>
            <span className="text-right">Số lượng</span>
            <span className="text-right">Giá vốn / con</span>
            <span />
          </div>
          <ul className="flex flex-col gap-2">
            {fields.map((field, index) => {
              const rowErrors = errors.items?.[index];
              return (
                <li
                  key={field.id}
                  className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 p-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_2.5rem] sm:border-0 sm:p-0"
                >
                  <label className="col-span-2 sm:col-span-1">
                    <span className="sr-only">Sản phẩm dòng {index + 1}</span>
                    <select
                      className={cn(cellInput, rowErrors?.productId && 'border-danger/70')}
                      {...register(`items.${index}.productId`, {
                        onChange: (event: { target: { value: string } }) =>
                          setValue(
                            `items.${index}.unitCost`,
                            suggestedCost(productById.get(event.target.value)),
                          ),
                      })}
                    >
                      <option value="">Chọn sản phẩm…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} (còn {product.stock})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Số lượng dòng {index + 1}</span>
                    <input
                      type="number"
                      min={1}
                      className={cn(
                        cellInput,
                        'text-right tabular-nums',
                        rowErrors?.quantity && 'border-danger/70',
                      )}
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Giá vốn dòng {index + 1}</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      className={cn(
                        cellInput,
                        'text-right tabular-nums',
                        rowErrors?.unitCost && 'border-danger/70',
                      )}
                      {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    aria-label={`Xoá dòng ${index + 1}`}
                    className="col-span-2 flex h-10 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30 sm:col-span-1"
                  >
                    <Trash2 size={16} />
                  </button>
                  {(rowErrors?.productId || rowErrors?.quantity || rowErrors?.unitCost) && (
                    <p role="alert" className="col-span-full text-xs text-danger">
                      {rowErrors.productId?.message ??
                        rowErrors.quantity?.message ??
                        rowErrors.unitCost?.message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {errors.items?.message && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errors.items.message}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            leftIcon={<Plus size={15} aria-hidden="true" />}
            onClick={() => append({ productId: '', quantity: 1, unitCost: 0 })}
          >
            Thêm dòng
          </Button>
        </fieldset>

        <Textarea
          label="Ghi chú"
          rows={2}
          className="min-h-20"
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Modal>
  );
}

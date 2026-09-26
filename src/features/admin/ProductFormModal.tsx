import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Product } from '@/types';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES, PRODUCT_CONDITIONS } from '@/types';
import { ATTRIBUTE_META, CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import { saveProduct } from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { toast } from '@/store/uiStore';
import { Button, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui';
import { productSchema, type ProductFormValues } from './schemas';

const ATTRIBUTE_OPTIONS = BAKUGAN_ATTRIBUTES.map((value) => ({
  value,
  label: `${ATTRIBUTE_META[value].label} — ${ATTRIBUTE_META[value].element}`,
}));
const SERIES_OPTIONS = BAKUGAN_SERIES.map((value) => ({ value, label: SERIES_META[value].label }));
const CONDITION_OPTIONS = PRODUCT_CONDITIONS.map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

function defaultsFor(product?: Product): ProductFormValues {
  if (!product) {
    return {
      name: 'Bakugan ',
      shortDescription: '',
      attribute: 'pyrus',
      series: 'battle-brawlers',
      condition: 'like-new',
      gPower: 600,
      price: 500_000,
      originalPrice: 0,
      stock: 1,
      isFeatured: false,
      isRare: false,
      isHidden: false,
    };
  }
  return {
    name: product.name,
    shortDescription: product.shortDescription,
    attribute: product.attribute,
    series: product.series,
    condition: product.condition,
    gPower: product.gPower,
    price: product.price,
    originalPrice: product.originalPrice ?? 0,
    stock: product.stock,
    isFeatured: product.isFeatured,
    isRare: product.isRare,
    isHidden: product.isHidden ?? false,
  };
}

/**
 * Thêm mới hoặc sửa sản phẩm. Mở lại bằng `key` khác nhau để form nạp đúng
 * dữ liệu của sản phẩm đang chọn.
 */
export function ProductFormModal({
  isOpen,
  onClose,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultsFor(product),
  });

  const onSubmit = async (values: ProductFormValues): Promise<void> => {
    try {
      const saved = await saveProduct(
        { ...values, originalPrice: values.originalPrice > 0 ? values.originalPrice : undefined },
        product?.id,
      );
      toast.success(product ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới', saved.name);
      onClose();
    } catch (error) {
      const fieldErrors =
        typeof error === 'object' && error !== null && 'fieldErrors' in error
          ? (error as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined;
      if (fieldErrors?.originalPrice) {
        setError('originalPrice', { type: 'server', message: fieldErrors.originalPrice });
      }
      toast.error('Lưu sản phẩm thất bại', getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      description={product ? product.name : 'Ảnh minh hoạ được tạo tự động theo hệ của sản phẩm.'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="product-form" isLoading={isSubmitting}>
            {product ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
          </Button>
        </div>
      }
    >
      <form
        id="product-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <Input
          label="Tên sản phẩm"
          required
          containerClassName="sm:col-span-2"
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Mô tả ngắn"
            required
            rows={2}
            className="min-h-20"
            error={errors.shortDescription?.message}
            {...register('shortDescription')}
          />
        </div>
        <Select
          label="Hệ"
          required
          options={ATTRIBUTE_OPTIONS}
          error={errors.attribute?.message}
          {...register('attribute')}
        />
        <Select
          label="Dòng"
          required
          options={SERIES_OPTIONS}
          error={errors.series?.message}
          {...register('series')}
        />
        <Select
          label="Tình trạng"
          required
          options={CONDITION_OPTIONS}
          error={errors.condition?.message}
          {...register('condition')}
        />
        <Input
          label="G-Power"
          type="number"
          required
          error={errors.gPower?.message}
          {...register('gPower', { valueAsNumber: true })}
        />
        <Input
          label="Tồn kho"
          type="number"
          required
          hint={product ? 'Sửa khi kiểm kê. Hàng mới về nên lập phiếu nhập.' : undefined}
          error={errors.stock?.message}
          {...register('stock', { valueAsNumber: true })}
        />
        <Input
          label="Giá bán (₫)"
          type="number"
          step={1000}
          required
          error={errors.price?.message}
          {...register('price', { valueAsNumber: true })}
        />
        <Input
          label="Giá gốc trước giảm (₫)"
          type="number"
          step={1000}
          hint="Để 0 nếu không giảm giá."
          error={errors.originalPrice?.message}
          {...register('originalPrice', { valueAsNumber: true })}
        />
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Checkbox label="Nổi bật trên trang chủ" {...register('isFeatured')} />
          <Checkbox label="Hàng hiếm (gắn nhãn HÀNG HIẾM)" {...register('isRare')} />
          <Checkbox label="Tạm ẩn khỏi cửa hàng" {...register('isHidden')} />
        </div>
      </form>
    </Modal>
  );
}

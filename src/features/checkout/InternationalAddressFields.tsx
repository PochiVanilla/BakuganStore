import { useMemo } from 'react';
import { CircleAlert } from 'lucide-react';
import type { InternationalAddress } from '@/types';
import { countryOptions, needsPostalCode } from '@/constants/countries';
import type { IntlAddressErrors } from '@/utils/intlAddress';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui';

export interface IntlContactErrors extends IntlAddressErrors {
  receiverName?: string;
  phone?: string;
}

/**
 * Địa chỉ gửi ra nước ngoài. Nhãn kèm tiếng Anh cho khách nước ngoài; `autoComplete`
 * theo chuẩn để trình duyệt tự điền địa chỉ giao hàng đã lưu.
 */
export function InternationalAddressFields({
  address,
  onAddress,
  receiverName,
  onReceiverName,
  phone,
  onPhone,
  errors,
}: {
  address: InternationalAddress;
  onAddress: (patch: Partial<InternationalAddress>) => void;
  receiverName: string;
  onReceiverName: (value: string) => void;
  phone: string;
  onPhone: (value: string) => void;
  errors: IntlContactErrors;
}) {
  const options = useMemo(() => countryOptions(), []);
  const postalRequired = !address.countryCode || needsPostalCode(address.countryCode);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Họ tên người nhận · Full name"
        name="intl-name"
        autoComplete="shipping name"
        required
        value={receiverName}
        onChange={(event) => onReceiverName(event.target.value)}
        error={errors.receiverName}
      />
      <Input
        label="Điện thoại kèm mã nước · Phone"
        name="intl-phone"
        type="tel"
        inputMode="tel"
        autoComplete="shipping tel"
        placeholder="+1 415 555 0123"
        required
        value={phone}
        onChange={(event) => onPhone(event.target.value)}
        error={errors.phone}
      />

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="intl-country" className="text-sm font-medium text-text">
          Nước nhận hàng · Country
          <span className="ml-1 text-accent-pink" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="intl-country"
          name="intl-country"
          autoComplete="shipping country"
          required
          value={address.countryCode}
          onChange={(event) => onAddress({ countryCode: event.target.value })}
          aria-invalid={Boolean(errors.countryCode)}
          aria-describedby={errors.countryCode ? 'intl-country-error' : undefined}
          className={cn(
            'h-12 w-full cursor-pointer rounded-xl border bg-surface-2/80 px-4 text-text transition-colors outline-none',
            errors.countryCode
              ? 'border-danger/70 focus:border-danger'
              : 'border-white/10 hover:border-white/20 focus:border-accent-cyan',
          )}
        >
          <option value="" disabled className="bg-surface-2">
            Chọn nước · Select a country
          </option>
          <optgroup label="Thường gửi · Popular" className="bg-surface-2">
            {options.popular.map((option) => (
              <option key={`popular-${option.code}`} value={option.code}>
                {option.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Tất cả các nước · All countries" className="bg-surface-2">
            {options.all.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </optgroup>
        </select>
        {errors.countryCode && (
          <p
            id="intl-country-error"
            role="alert"
            className="flex items-start gap-1.5 text-sm text-danger"
          >
            <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {errors.countryCode}
          </p>
        )}
      </div>

      <Input
        label="Địa chỉ · Street address"
        name="intl-line1"
        autoComplete="shipping address-line1"
        placeholder="VD: 350 5th Ave"
        required
        containerClassName="sm:col-span-2"
        value={address.line1}
        onChange={(event) => onAddress({ line1: event.target.value })}
        error={errors.line1}
      />
      <Input
        label="Căn hộ, toà nhà (nếu có) · Apt, suite, unit"
        name="intl-line2"
        autoComplete="shipping address-line2"
        containerClassName="sm:col-span-2"
        value={address.line2 ?? ''}
        onChange={(event) => onAddress({ line2: event.target.value })}
        error={errors.line2}
      />
      <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
        <Input
          label="Thành phố · City"
          name="intl-city"
          autoComplete="shipping address-level2"
          required
          value={address.city}
          onChange={(event) => onAddress({ city: event.target.value })}
          error={errors.city}
        />
        <Input
          label="Bang / tỉnh · State"
          name="intl-region"
          autoComplete="shipping address-level1"
          value={address.region ?? ''}
          onChange={(event) => onAddress({ region: event.target.value })}
          error={errors.region}
        />
        <Input
          label="Mã bưu chính · Postcode"
          name="intl-postal"
          autoComplete="shipping postal-code"
          required={postalRequired}
          value={address.postalCode ?? ''}
          onChange={(event) => onAddress({ postalCode: event.target.value })}
          error={errors.postalCode}
        />
      </div>
      <p className="text-xs text-text-muted sm:col-span-2">
        Ghi bằng chữ Latin như khi gửi thư quốc tế · Please use Latin letters.
      </p>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES, PRODUCT_CONDITIONS } from '@/types';
import {
  ATTRIBUTE_META,
  CONDITION_LABELS,
  G_POWER_RANGES,
  PRICE_RANGES,
  SERIES_META,
} from '@/constants/catalog';
import { cn } from '@/utils/cn';
import { AttributeIcon } from '@/components/ui';
import type { ProductFilterActions, ProductFilterState } from './useProductFilters';

type FiltersProps = ProductFilterState & ProductFilterActions;

function FilterGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-white/8 py-4 first:pt-0 last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-2 text-left font-display text-sm font-bold text-text transition hover:text-accent-cyan"
        >
          {title}
          <ChevronDown
            size={16}
            className={cn('shrink-0 transition-transform', isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      {isOpen && <div className="mt-3.5">{children}</div>}
    </section>
  );
}

function CheckOption({
  checked,
  onChange,
  label,
  hint,
  accentColor,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
        checked ? 'bg-white/8 text-text' : 'text-text-muted hover:bg-white/4 hover:text-text',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-white/25 bg-surface-2 accent-[#7B4BE8]"
      />
      {icon && (
        <span className="shrink-0" style={accentColor ? { color: accentColor } : undefined}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {label}
        {hint && <span className="ml-1.5 text-[11px] text-text-muted/70">{hint}</span>}
      </span>
    </label>
  );
}

function RadioOption({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  name: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
        checked ? 'bg-white/8 text-text' : 'text-text-muted hover:bg-white/4 hover:text-text',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[#7B4BE8]"
      />
      {label}
    </label>
  );
}

export function ProductFilters(props: FiltersProps) {
  const {
    attributes,
    series,
    conditions,
    minPrice,
    maxPrice,
    minGPower,
    maxGPower,
    inStockOnly,
    onSaleOnly,
    activeCount,
    toggleAttribute,
    toggleSeries,
    toggleCondition,
    setPriceRange,
    setGPowerRange,
    setInStockOnly,
    setOnSaleOnly,
    resetFilters,
  } = props;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-text">
          Bộ lọc
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-accent-pink px-2 py-0.5 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted transition hover:text-accent-pink"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Xoá lọc
          </button>
        )}
      </div>

      <FilterGroup title="Hệ (Attribute)">
        <div className="flex flex-col gap-0.5">
          {BAKUGAN_ATTRIBUTES.map((attribute) => {
            const meta = ATTRIBUTE_META[attribute];
            return (
              <CheckOption
                key={attribute}
                checked={attributes.includes(attribute)}
                onChange={() => toggleAttribute(attribute)}
                label={meta.label}
                hint={meta.element}
                accentColor={meta.color}
                icon={<AttributeIcon attribute={attribute} size={16} glow />}
              />
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Dòng (Series)">
        <div className="flex flex-col gap-0.5">
          {BAKUGAN_SERIES.map((item) => (
            <CheckOption
              key={item}
              checked={series.includes(item)}
              onChange={() => toggleSeries(item)}
              label={SERIES_META[item].label}
              hint={SERIES_META[item].years}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Tình trạng">
        <div className="flex flex-col gap-0.5">
          {PRODUCT_CONDITIONS.map((condition) => (
            <CheckOption
              key={condition}
              checked={conditions.includes(condition)}
              onChange={() => toggleCondition(condition)}
              label={CONDITION_LABELS[condition]}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Khoảng giá">
        <div className="flex flex-col gap-0.5">
          <RadioOption
            name="price-range"
            checked={minPrice === undefined && maxPrice === undefined}
            onChange={() => setPriceRange(undefined, undefined)}
            label="Tất cả mức giá"
          />
          {PRICE_RANGES.map((range) => (
            <RadioOption
              key={range.label}
              name="price-range"
              checked={
                minPrice === range.min && (maxPrice ?? Number.MAX_SAFE_INTEGER) === range.max
              }
              onChange={() => setPriceRange(range.min, range.max)}
              label={range.label}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="G-Power">
        <div className="flex flex-col gap-0.5">
          <RadioOption
            name="gpower-range"
            checked={minGPower === undefined && maxGPower === undefined}
            onChange={() => setGPowerRange(undefined, undefined)}
            label="Tất cả G-Power"
          />
          {G_POWER_RANGES.map((range) => (
            <RadioOption
              key={range.label}
              name="gpower-range"
              checked={
                minGPower === range.min && (maxGPower ?? Number.MAX_SAFE_INTEGER) === range.max
              }
              onChange={() => setGPowerRange(range.min, range.max)}
              label={range.label}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Khác">
        <div className="flex flex-col gap-0.5">
          <CheckOption
            checked={inStockOnly}
            onChange={() => setInStockOnly(!inStockOnly)}
            label="Chỉ hiện sản phẩm còn hàng"
          />
          <CheckOption
            checked={onSaleOnly}
            onChange={() => setOnSaleOnly(!onSaleOnly)}
            label="Chỉ hiện sản phẩm đang giảm giá"
          />
        </div>
      </FilterGroup>
    </div>
  );
}

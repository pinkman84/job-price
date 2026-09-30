import type { TaxRate } from '../types'

export interface TaxRateOption {
  value: string
  rate: TaxRate
  label: string
}

// Fixed UK VAT model. Deliberately not user-editable — every tax rate picker
// in the app should offer exactly these four options.
export const TAX_RATE_OPTIONS: TaxRateOption[] = [
  { value: 'none', rate: null, label: 'No tax' },
  { value: '0', rate: 0, label: 'Zero-rated (0%)' },
  { value: '0.05', rate: 0.05, label: 'Reduced rate (5%)' },
  { value: '0.2', rate: 0.2, label: 'Standard rate (20%)' },
]

export function taxRateToFormValue(rate: TaxRate): string {
  return TAX_RATE_OPTIONS.find((o) => o.rate === rate)?.value ?? 'none'
}

export function formValueToTaxRate(value: string): TaxRate {
  return (TAX_RATE_OPTIONS.find((o) => o.value === value)?.rate ?? null) as TaxRate
}

export function taxRateLabel(rate: TaxRate): string {
  return TAX_RATE_OPTIONS.find((o) => o.rate === rate)?.label ?? 'No tax'
}

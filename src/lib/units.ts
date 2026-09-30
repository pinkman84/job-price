export const UNIT_OPTIONS = [
  { value: 'm', label: 'M' },
  { value: 'm2', label: 'M²' },
  { value: 'kg', label: 'kg' },
  { value: 'tonnes', label: 'Tonnes' },
  { value: 'item', label: 'Item' },
] as const

export type UnitValue = (typeof UNIT_OPTIONS)[number]['value']

// Best-effort match of a material's free-text catalog unit (e.g. "kg", "each")
// onto one of the fixed line-item unit options, defaulting to "item".
export function normalizeUnit(rawUnit: string | null): UnitValue {
  const normalized = (rawUnit ?? '').trim().toLowerCase()
  const match = UNIT_OPTIONS.find((o) => o.value === normalized || (o.value === 'item' && normalized === 'each'))
  return match?.value ?? 'item'
}

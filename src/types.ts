export type JobStatus = 'draft' | 'sent' | 'awarded' | 'lost' | 'complete'

export interface Address {
  id: string
  user_id: string
  name: string | null
  line1: string
  line2: string | null
  city: string | null
  country: string | null
  postcode: string | null
  created_at: string
}

export type AddressInput = Omit<Address, 'id' | 'user_id' | 'created_at'>

export interface Client {
  id: string
  user_id: string
  name: string
  address_id: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  default_margin_percent: number
  home_address_id: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Material {
  id: string
  user_id: string
  name: string
  unit: string | null
  created_at: string
}

export interface MaterialPrice {
  id: string
  user_id: string
  material_id: string
  supplier_id: string
  cost: number
  currency_code: string
  recorded_at: string
}

export type LabourRateType = 'hourly' | 'daily'

export interface LabourRate {
  id: string
  user_id: string
  role_name: string
  rate_type: LabourRateType
  rate: number
  created_at: string
}

// UK VAT model: a fixed set of rates chosen from a dropdown, not user-managed.
// null means no tax code has been assigned to the job.
export type TaxRate = null | 0 | 0.05 | 0.2

export interface Job {
  id: string
  user_id: string
  name: string
  client_id: string | null
  address_id: string | null
  status: JobStatus
  date_created: string
  date_awarded: string | null
  due_date: string | null
  currency_code: string
  subtotal: number
  tax_rate: TaxRate
  tax_amount: number
  total: number
  paid_in_full: boolean
  amount_outstanding: number
  created_at: string
  updated_at: string
}

export type JobInput = Pick<
  Job,
  | 'name'
  | 'client_id'
  | 'address_id'
  | 'status'
  | 'due_date'
  | 'currency_code'
  | 'subtotal'
  | 'tax_rate'
  | 'paid_in_full'
  | 'amount_outstanding'
>

export type LineItemKind = 'material' | 'labour' | 'other'

export interface JobLineItem {
  id: string
  job_id: string
  kind: LineItemKind
  material_id: string | null
  supplier_id: string | null
  labour_rate_id: string | null
  description: string
  quantity: number
  unit: string | null
  unit_cost: number
  margin_percent: number
  line_total: number
  sort_order: number
  created_at: string
}

export type JobLineItemInput = Pick<
  JobLineItem,
  | 'kind'
  | 'material_id'
  | 'supplier_id'
  | 'labour_rate_id'
  | 'description'
  | 'quantity'
  | 'unit'
  | 'unit_cost'
  | 'margin_percent'
  | 'sort_order'
>

export interface JobImage {
  id: string
  job_id: string
  storage_path: string
  created_at: string
}

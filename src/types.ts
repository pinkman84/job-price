export type JobStatus = 'draft' | 'quoted' | 'won' | 'lost'

export interface LineItem {
  id: string
  description: string
  amount: number
}

// `details` holds the optional, evolving fields (notes, line items, etc.)
// as JSON so we can add new optional attributes without a migration for each one.
export interface JobDetails {
  notes?: string
  lineItems?: LineItem[]
  [key: string]: unknown
}

export interface Job {
  id: string
  user_id: string
  name: string
  location: string
  client: string
  price: number
  status: JobStatus
  details: JobDetails
  created_at: string
  updated_at: string
}

export interface JobImage {
  id: string
  job_id: string
  storage_path: string
  created_at: string
}

export type JobInput = Pick<Job, 'name' | 'location' | 'client' | 'price' | 'status'> & {
  details?: JobDetails
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Address, Client, Job, JobLineItem } from '../types'

function formatMoney(amount: number, currencyCode: string) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: currencyCode })
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [address, setAddress] = useState<Address | null>(null)
  const [lineItems, setLineItems] = useState<JobLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: jobData, error: jobError } = await supabase.from('jobs').select('*').eq('id', id).single()
      if (jobError) {
        setError(jobError.message)
        setLoading(false)
        return
      }
      setJob(jobData)

      const [clientRes, addressRes, itemsRes] = await Promise.all([
        jobData.client_id
          ? supabase.from('clients').select('*').eq('id', jobData.client_id).single()
          : Promise.resolve({ data: null }),
        jobData.address_id
          ? supabase.from('addresses').select('*').eq('id', jobData.address_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('job_line_items').select('*').eq('job_id', jobData.id).order('sort_order'),
      ])

      setClient(clientRes.data)
      setAddress(addressRes.data)
      setLineItems(itemsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!job || !confirm(`Delete "${job.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('jobs').delete().eq('id', job.id)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  if (loading) return <div className="page-loading">Loading…</div>
  if (error) return <p className="form-error">{error}</p>
  if (!job) return <p>Job not found.</p>

  return (
    <div className="page">
      <header className="page-header">
        <h1>{job.name}</h1>
        <div className="header-actions">
          <Link className="button" to={`/jobs/${job.id}/edit`}>
            Edit
          </Link>
          <button className="link-button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

      <div className="job-detail">
        <div className="job-detail-row">
          <span className="label">Status</span>
          <span className={`job-status job-status-${job.status}`}>{job.status}</span>
        </div>
        <div className="job-detail-row">
          <span className="label">Client</span>
          <span>{client?.name ?? '—'}</span>
        </div>
        <div className="job-detail-row">
          <span className="label">Site address</span>
          <span>
            {address
              ? [address.line1, address.line2, address.city, address.postcode, address.country]
                  .filter(Boolean)
                  .join(', ')
              : '—'}
          </span>
        </div>
        <div className="job-detail-row">
          <span className="label">Due date</span>
          <span>{job.due_date ?? '—'}</span>
        </div>
        {job.date_awarded && (
          <div className="job-detail-row">
            <span className="label">Awarded</span>
            <span>{new Date(job.date_awarded).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {lineItems.length > 0 && (
        <table className="line-items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unit_cost, job.currency_code)}</td>
                <td>{formatMoney(item.line_total, job.currency_code)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="totals-summary">
        <div>
          <span>Subtotal</span>
          <span>{formatMoney(job.subtotal, job.currency_code)}</span>
        </div>
        <div>
          <span>Tax ({(job.tax_rate * 100).toFixed(2)}%)</span>
          <span>{formatMoney(job.tax_amount, job.currency_code)}</span>
        </div>
        <div className="totals-grand">
          <span>Total</span>
          <span>{formatMoney(job.total, job.currency_code)}</span>
        </div>
      </div>

      <div className="job-detail" style={{ marginTop: '1rem' }}>
        <div className="job-detail-row">
          <span className="label">Paid in full</span>
          <span>{job.paid_in_full ? 'Yes' : 'No'}</span>
        </div>
        <div className="job-detail-row">
          <span className="label">Amount outstanding</span>
          <span>{formatMoney(job.amount_outstanding, job.currency_code)}</span>
        </div>
      </div>

      <Link className="link-button" to="/">
        ← Back to jobs
      </Link>
    </div>
  )
}

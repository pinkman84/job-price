import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { findOrCreateByName, resolveAddressId } from '../lib/resolvers'
import { useAuth } from '../context/AuthContext'
import type { Address, JobStatus } from '../types'

interface LineItemRow {
  key: string
  description: string
  quantity: string
  unitCost: string
}

function emptyLineItem(): LineItemRow {
  return { key: crypto.randomUUID(), description: '', quantity: '1', unitCost: '0' }
}

export default function JobForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { session } = useAuth()

  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [existingAddressId, setExistingAddressId] = useState<string | null>(null)
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [postcode, setPostcode] = useState('')
  const [status, setStatus] = useState<JobStatus>('draft')
  const [dueDate, setDueDate] = useState('')
  const [taxRatePercent, setTaxRatePercent] = useState('0')
  const [paidInFull, setPaidInFull] = useState(false)
  const [amountOutstanding, setAmountOutstanding] = useState('0')
  const [lineItems, setLineItems] = useState<LineItemRow[]>([emptyLineItem()])
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([])

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => setClientOptions(data ?? []))
  }, [])

  useEffect(() => {
    if (!isEditing) return

    async function load() {
      const { data: job, error: jobError } = await supabase.from('jobs').select('*').eq('id', id).single()
      if (jobError) {
        setError(jobError.message)
        setLoading(false)
        return
      }

      setName(job.name)
      setStatus(job.status)
      setDueDate(job.due_date ?? '')
      setTaxRatePercent(String(job.tax_rate * 100))
      setPaidInFull(job.paid_in_full)
      setAmountOutstanding(String(job.amount_outstanding))
      setExistingAddressId(job.address_id)

      if (job.client_id) {
        const { data: client } = await supabase.from('clients').select('name').eq('id', job.client_id).single()
        if (client) setClientName(client.name)
      }

      if (job.address_id) {
        const { data: address } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', job.address_id)
          .single<Address>()
        if (address) {
          setAddressLine1(address.line1)
          setAddressLine2(address.line2 ?? '')
          setCity(address.city ?? '')
          setCountry(address.country ?? '')
          setPostcode(address.postcode ?? '')
        }
      }

      const { data: items } = await supabase
        .from('job_line_items')
        .select('*')
        .eq('job_id', id)
        .order('sort_order')

      if (items && items.length > 0) {
        setLineItems(
          items.map((item) => ({
            key: item.id,
            description: item.description,
            quantity: String(item.quantity),
            unitCost: String(item.unit_cost),
          })),
        )
      }

      setLoading(false)
    }

    load()
  }, [id, isEditing])

  const subtotal = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const cost = Number(item.unitCost) || 0
    return sum + qty * cost
  }, 0)
  const taxRate = (Number(taxRatePercent) || 0) / 100
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100
  const total = subtotal + taxAmount

  function updateLineItem(key: string, patch: Partial<LineItemRow>) {
    setLineItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeLineItem(key: string) {
    setLineItems((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const userId = session!.user.id
      const clientId = await findOrCreateByName('clients', clientName, userId)
      const addressId = await resolveAddressId(
        existingAddressId,
        { line1: addressLine1, line2: addressLine2, city, country, postcode },
        userId,
      )

      const jobPayload = {
        name,
        client_id: clientId,
        address_id: addressId,
        status,
        due_date: dueDate || null,
        tax_rate: taxRate,
        paid_in_full: paidInFull,
        amount_outstanding: Number(amountOutstanding) || 0,
        subtotal,
        date_awarded: status === 'awarded' ? new Date().toISOString() : null,
      }

      const jobResult = isEditing
        ? await supabase.from('jobs').update(jobPayload).eq('id', id).select('id').single()
        : await supabase
            .from('jobs')
            .insert({ ...jobPayload, user_id: userId })
            .select('id')
            .single()

      if (jobResult.error) throw jobResult.error
      const jobId = jobResult.data.id

      if (isEditing) {
        const { error: deleteError } = await supabase.from('job_line_items').delete().eq('job_id', jobId)
        if (deleteError) throw deleteError
      }

      const itemsToInsert = lineItems
        .filter((row) => row.description.trim())
        .map((row, index) => ({
          job_id: jobId,
          description: row.description.trim(),
          quantity: Number(row.quantity) || 0,
          unit_cost: Number(row.unitCost) || 0,
          sort_order: index,
        }))

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('job_line_items').insert(itemsToInsert)
        if (itemsError) throw itemsError
      }

      navigate(`/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving the job.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>

  return (
    <div className="page">
      <header className="page-header">
        <h1>{isEditing ? 'Edit job' : 'New job'}</h1>
      </header>

      <form className="job-form" onSubmit={handleSubmit}>
        <label>
          Job name *
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Client
          <input
            list="client-options"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Type to search or add a new client"
          />
          <datalist id="client-options">
            {clientOptions.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>

        <fieldset className="form-fieldset">
          <legend>Job site address</legend>
          <label>
            Address line 1
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </label>
          <label>
            Address line 2
            <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          </label>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            Postcode
            <input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </label>
          <label>
            Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </fieldset>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="awarded">Awarded</option>
            <option value="lost">Lost</option>
            <option value="complete">Complete</option>
          </select>
        </label>

        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <fieldset className="form-fieldset">
          <legend>Line items</legend>
          <div className="line-items">
            {lineItems.map((item) => (
              <div className="line-item-row" key={item.key}>
                <input
                  className="line-item-desc"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(item.key, { description: e.target.value })}
                />
                <input
                  className="line-item-qty"
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.key, { quantity: e.target.value })}
                />
                <input
                  className="line-item-cost"
                  type="number"
                  step="0.01"
                  placeholder="Unit cost"
                  value={item.unitCost}
                  onChange={(e) => updateLineItem(item.key, { unitCost: e.target.value })}
                />
                <span className="line-item-total">
                  {((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)).toFixed(2)}
                </span>
                <button
                  type="button"
                  className="link-button remove-line"
                  onClick={() => removeLineItem(item.key)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="link-button" onClick={() => setLineItems((r) => [...r, emptyLineItem()])}>
            + Add line
          </button>
        </fieldset>

        <label>
          Tax rate (%)
          <input
            type="number"
            step="0.01"
            min="0"
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(e.target.value)}
          />
        </label>

        <div className="totals-summary">
          <div>
            <span>Subtotal</span>
            <span>{subtotal.toFixed(2)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{taxAmount.toFixed(2)}</span>
          </div>
          <div className="totals-grand">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </div>
        </div>

        <label>
          Amount outstanding
          <input
            type="number"
            step="0.01"
            value={amountOutstanding}
            onChange={(e) => setAmountOutstanding(e.target.value)}
          />
        </label>

        <label className="checkbox-label">
          <input type="checkbox" checked={paidInFull} onChange={(e) => setPaidInFull(e.target.checked)} />
          Paid in full
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save job'}
          </button>
          <button type="button" className="link-button" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

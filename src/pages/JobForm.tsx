import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { findOrCreateByName, resolveAddressId } from '../lib/resolvers'
import { TAX_RATE_OPTIONS, formValueToTaxRate, taxRateToFormValue } from '../lib/taxRates'
import { useAuth } from '../context/AuthContext'
import type { Address, JobStatus, LabourRate, LineItemKind } from '../types'

interface LineItemRow {
  key: string
  materialId: string | null
  labourRateId: string | null
  description: string
  quantity: string
  unitCost: string
  marginPercent: string
}

function emptyLineItem(marginPercent = '0'): LineItemRow {
  return {
    key: crypto.randomUUID(),
    materialId: null,
    labourRateId: null,
    description: '',
    quantity: '1',
    unitCost: '0',
    marginPercent,
  }
}

function lineTotal(row: LineItemRow) {
  const qty = Number(row.quantity) || 0
  const cost = Number(row.unitCost) || 0
  const margin = Number(row.marginPercent) || 0
  return Math.round(qty * cost * (1 + margin / 100) * 100) / 100
}

interface MaterialOption {
  id: string
  name: string
  unit: string | null
  latestCost: number | null
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
  const [taxRateValue, setTaxRateValue] = useState('none')
  const [paidInFull, setPaidInFull] = useState(false)
  const [amountOutstanding, setAmountOutstanding] = useState('0')

  const [defaultMargin, setDefaultMargin] = useState(0)
  const [materialLines, setMaterialLines] = useState<LineItemRow[]>([])
  const [labourLines, setLabourLines] = useState<LineItemRow[]>([])
  const [otherLines, setOtherLines] = useState<LineItemRow[]>([])

  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([])
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([])
  const [labourRates, setLabourRates] = useState<LabourRate[]>([])

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => setClientOptions(data ?? []))

    supabase
      .from('labour_rates')
      .select('*')
      .order('role_name')
      .then(({ data }) => setLabourRates(data ?? []))

    async function loadMaterials() {
      const [{ data: materials }, { data: prices }] = await Promise.all([
        supabase.from('materials').select('id, name, unit').order('name'),
        supabase.from('material_latest_prices').select('material_id, cost, recorded_at'),
      ])

      const latestByMaterial = new Map<string, { cost: number; recordedAt: string }>()
      for (const p of prices ?? []) {
        const existing = latestByMaterial.get(p.material_id)
        if (!existing || p.recorded_at > existing.recordedAt) {
          latestByMaterial.set(p.material_id, { cost: p.cost, recordedAt: p.recorded_at })
        }
      }

      setMaterialOptions(
        (materials ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          unit: m.unit,
          latestCost: latestByMaterial.get(m.id)?.cost ?? null,
        })),
      )
    }
    loadMaterials()

    if (!isEditing) {
      supabase
        .from('profiles')
        .select('default_margin_percent')
        .eq('id', session!.user.id)
        .maybeSingle()
        .then(({ data }) => {
          const margin = data?.default_margin_percent ?? 0
          setDefaultMargin(margin)
          setMaterialLines([emptyLineItem(String(margin))])
          setLabourLines([emptyLineItem('0')])
          setOtherLines([emptyLineItem('0')])
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setTaxRateValue(taxRateToFormValue(job.tax_rate))
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

      const toRow = (item: NonNullable<typeof items>[number]): LineItemRow => ({
        key: item.id,
        materialId: item.material_id,
        labourRateId: item.labour_rate_id,
        description: item.description,
        quantity: String(item.quantity),
        unitCost: String(item.unit_cost),
        marginPercent: String(item.margin_percent),
      })

      const byKind = (kind: LineItemKind) => (items ?? []).filter((i) => i.kind === kind).map(toRow)

      setMaterialLines(byKind('material').length > 0 ? byKind('material') : [emptyLineItem()])
      setLabourLines(byKind('labour').length > 0 ? byKind('labour') : [emptyLineItem('0')])
      setOtherLines(byKind('other').length > 0 ? byKind('other') : [emptyLineItem('0')])

      setLoading(false)
    }

    load()
  }, [id, isEditing])

  const subtotal = [...materialLines, ...labourLines, ...otherLines].reduce((sum, row) => sum + lineTotal(row), 0)
  const taxRate = formValueToTaxRate(taxRateValue)
  const taxAmount = Math.round(subtotal * (taxRate ?? 0) * 100) / 100
  const total = subtotal + taxAmount

  function updateRow(
    setter: React.Dispatch<React.SetStateAction<LineItemRow[]>>,
    key: string,
    patch: Partial<LineItemRow>,
  ) {
    setter((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeRow(setter: React.Dispatch<React.SetStateAction<LineItemRow[]>>, key: string) {
    setter((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows))
  }

  function handleMaterialSelect(key: string, materialId: string) {
    const material = materialOptions.find((m) => m.id === materialId)
    updateRow(setMaterialLines, key, {
      materialId: material?.id ?? null,
      description: material ? `${material.name}${material.unit ? ` (${material.unit})` : ''}` : '',
      unitCost: material?.latestCost != null ? String(material.latestCost) : '0',
    })
  }

  function handleLabourSelect(key: string, labourRateId: string) {
    const rate = labourRates.find((r) => r.id === labourRateId)
    updateRow(setLabourLines, key, {
      labourRateId: rate?.id ?? null,
      description: rate ? `${rate.role_name} (${rate.rate_type === 'hourly' ? 'per hour' : 'per day'})` : '',
      unitCost: rate ? String(rate.rate) : '0',
    })
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

      const buildInserts = (rows: LineItemRow[], kind: LineItemKind, offset: number) =>
        rows
          .filter((row) => row.description.trim())
          .map((row, index) => ({
            job_id: jobId,
            kind,
            material_id: row.materialId,
            labour_rate_id: row.labourRateId,
            description: row.description.trim(),
            quantity: Number(row.quantity) || 0,
            unit_cost: Number(row.unitCost) || 0,
            margin_percent: Number(row.marginPercent) || 0,
            sort_order: offset + index,
          }))

      const itemsToInsert = [
        ...buildInserts(materialLines, 'material', 0),
        ...buildInserts(labourLines, 'labour', 100),
        ...buildInserts(otherLines, 'other', 200),
      ]

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
          <legend>Materials</legend>
          <div className="line-items">
            {materialLines.map((item) => (
              <div className="line-item-row material-line-row" key={item.key}>
                <select
                  value={item.materialId ?? ''}
                  onChange={(e) => (e.target.value ? handleMaterialSelect(item.key, e.target.value) : updateRow(setMaterialLines, item.key, { materialId: null }))}
                >
                  <option value="">Bespoke…</option>
                  {materialOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.unit ? ` (${m.unit})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  className="line-item-desc"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateRow(setMaterialLines, item.key, { description: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateRow(setMaterialLines, item.key, { quantity: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Unit cost"
                  value={item.unitCost}
                  onChange={(e) => updateRow(setMaterialLines, item.key, { unitCost: e.target.value })}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Margin %"
                  value={item.marginPercent}
                  onChange={(e) => updateRow(setMaterialLines, item.key, { marginPercent: e.target.value })}
                />
                <span className="line-item-total">{lineTotal(item).toFixed(2)}</span>
                <button type="button" className="link-button remove-line" onClick={() => removeRow(setMaterialLines, item.key)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="link-button" onClick={() => setMaterialLines((r) => [...r, emptyLineItem(String(defaultMargin))])}>
            + Add material
          </button>
        </fieldset>

        <fieldset className="form-fieldset">
          <legend>Labour</legend>
          <div className="line-items">
            {labourLines.map((item) => (
              <div className="line-item-row labour-line-row" key={item.key}>
                <select
                  value={item.labourRateId ?? ''}
                  onChange={(e) => (e.target.value ? handleLabourSelect(item.key, e.target.value) : updateRow(setLabourLines, item.key, { labourRateId: null }))}
                >
                  <option value="">Custom…</option>
                  {labourRates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.role_name} ({r.rate_type === 'hourly' ? '/hr' : '/day'})
                    </option>
                  ))}
                </select>
                <input
                  className="line-item-desc"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateRow(setLabourLines, item.key, { description: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Hours/days"
                  value={item.quantity}
                  onChange={(e) => updateRow(setLabourLines, item.key, { quantity: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate"
                  value={item.unitCost}
                  onChange={(e) => updateRow(setLabourLines, item.key, { unitCost: e.target.value })}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Margin %"
                  value={item.marginPercent}
                  onChange={(e) => updateRow(setLabourLines, item.key, { marginPercent: e.target.value })}
                />
                <span className="line-item-total">{lineTotal(item).toFixed(2)}</span>
                <button type="button" className="link-button remove-line" onClick={() => removeRow(setLabourLines, item.key)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="link-button" onClick={() => setLabourLines((r) => [...r, emptyLineItem('0')])}>
            + Add labour
          </button>
        </fieldset>

        <fieldset className="form-fieldset">
          <legend>Other charges</legend>
          <p className="field-hint">Flat one-off amounts — contingency, callout fees, or just a number to scare off a tricky job.</p>
          <div className="line-items">
            {otherLines.map((item) => (
              <div className="line-item-row other-line-row" key={item.key}>
                <input
                  className="line-item-desc"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateRow(setOtherLines, item.key, { description: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateRow(setOtherLines, item.key, { quantity: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={item.unitCost}
                  onChange={(e) => updateRow(setOtherLines, item.key, { unitCost: e.target.value })}
                />
                <span className="line-item-total">{lineTotal(item).toFixed(2)}</span>
                <button type="button" className="link-button remove-line" onClick={() => removeRow(setOtherLines, item.key)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="link-button" onClick={() => setOtherLines((r) => [...r, emptyLineItem('0')])}>
            + Add charge
          </button>
        </fieldset>

        <label>
          Tax rate
          <select value={taxRateValue} onChange={(e) => setTaxRateValue(e.target.value)}>
            {TAX_RATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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

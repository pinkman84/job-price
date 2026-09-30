import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { LabourRate, LabourRateType } from '../types'

export default function LabourRates() {
  const { session } = useAuth()
  const [rates, setRates] = useState<LabourRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [roleName, setRoleName] = useState('')
  const [rateType, setRateType] = useState<LabourRateType>('hourly')
  const [rate, setRate] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('labour_rates').select('*').order('role_name')
    if (error) {
      setError(error.message)
    } else {
      setRates(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error: insertError } = await supabase.from('labour_rates').insert({
      user_id: session!.user.id,
      role_name: roleName.trim(),
      rate_type: rateType,
      rate: Number(rate) || 0,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setRoleName('')
    setRate('')
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this labour rate?')) return
    const { error } = await supabase.from('labour_rates').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Labour rates</h1>
      </header>

      <form className="job-form" onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <label>
          Role name *
          <input
            required
            placeholder="e.g. Supervisor, Journeyman, Labourer, Apprentice"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
        </label>
        <label>
          Rate type
          <select value={rateType} onChange={(e) => setRateType(e.target.value as LabourRateType)}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <label>
          Rate (£) *
          <input required type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add rate'}
          </button>
        </div>
      </form>

      {loading && <p>Loading…</p>}
      {!loading && rates.length === 0 && <p className="empty-state">No labour rates yet.</p>}

      {!loading && rates.length > 0 && (
        <table className="line-items-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Type</th>
              <th>Rate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.role_name}</td>
                <td>{r.rate_type === 'hourly' ? 'Per hour' : 'Per day'}</td>
                <td>{r.rate.toLocaleString(undefined, { style: 'currency', currency: 'GBP' })}</td>
                <td>
                  <button className="link-button" onClick={() => handleDelete(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

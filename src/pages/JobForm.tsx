import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { JobStatus } from '../types'

export default function JobForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { session } = useAuth()

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [client, setClient] = useState('')
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState<JobStatus>('draft')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) return

    async function load() {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single()
      if (error) {
        setError(error.message)
      } else if (data) {
        setName(data.name)
        setLocation(data.location)
        setClient(data.client)
        setPrice(String(data.price))
        setStatus(data.status)
        setNotes(data.details?.notes ?? '')
      }
      setLoading(false)
    }

    load()
  }, [id, isEditing])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      name,
      location,
      client,
      price: Number(price) || 0,
      status,
      details: { notes: notes || undefined },
    }

    const result = isEditing
      ? await supabase.from('jobs').update(payload).eq('id', id).select('id').single()
      : await supabase
          .from('jobs')
          .insert({ ...payload, user_id: session?.user.id })
          .select('id')
          .single()

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    navigate(`/jobs/${result.data.id}`)
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
          <input value={client} onChange={(e) => setClient(e.target.value)} />
        </label>

        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>

        <label>
          Price *
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
            <option value="draft">Draft</option>
            <option value="quoted">Quoted</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </label>

        <label>
          Notes
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

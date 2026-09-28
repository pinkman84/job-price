import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { resolveAddressId } from '../lib/resolvers'
import { useAuth } from '../context/AuthContext'
import type { Address } from '../types'

interface ClientRow {
  id: string
  name: string
  address: Address | null
  outstanding: number
}

function formatAddress(address: Address | null) {
  if (!address) return '—'
  return [address.line1, address.line2, address.city, address.postcode, address.country].filter(Boolean).join(', ')
}

export default function ClientsList() {
  const { session } = useAuth()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [clientsRes, outstandingRes] = await Promise.all([
      supabase.from('clients').select('*, address:addresses(*)').order('name'),
      supabase.from('client_outstanding_totals').select('*'),
    ])

    if (clientsRes.error) {
      setError(clientsRes.error.message)
      setLoading(false)
      return
    }

    const outstandingByClient = new Map<string, number>(
      (outstandingRes.data ?? []).map((row) => [row.client_id, row.outstanding ?? 0]),
    )

    setClients(
      (clientsRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        outstanding: outstandingByClient.get(c.id) ?? 0,
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const userId = session!.user.id
      const addressId = await resolveAddressId(null, { line1, line2, city, country, postcode }, userId)

      const { error: insertError } = await supabase
        .from('clients')
        .insert({ user_id: userId, name: name.trim(), address_id: addressId })

      if (insertError) throw insertError

      setName('')
      setLine1('')
      setLine2('')
      setCity('')
      setPostcode('')
      setCountry('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save client.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this client? Jobs referencing them will keep their data but lose the link.')) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Clients</h1>
      </header>

      <form className="job-form" onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <label>
          Name *
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <fieldset className="form-fieldset">
          <legend>Billing address (optional)</legend>
          <label>
            Address line 1
            <input value={line1} onChange={(e) => setLine1(e.target.value)} />
          </label>
          <label>
            Address line 2
            <input value={line2} onChange={(e) => setLine2(e.target.value)} />
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

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add client'}
          </button>
        </div>
      </form>

      {loading && <p>Loading…</p>}

      {!loading && clients.length === 0 && <p className="empty-state">No clients yet.</p>}

      {!loading && clients.length > 0 && (
        <table className="line-items-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{formatAddress(client.address)}</td>
                <td>{client.outstanding.toLocaleString(undefined, { style: 'currency', currency: 'GBP' })}</td>
                <td>
                  <button className="link-button" onClick={() => handleDelete(client.id)}>
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

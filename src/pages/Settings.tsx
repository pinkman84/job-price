import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { resolveAddressId } from '../lib/resolvers'
import { useAuth } from '../context/AuthContext'
import type { Address } from '../types'

export default function Settings() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [defaultMargin, setDefaultMargin] = useState('0')
  const [homeAddressId, setHomeAddressId] = useState<string | null>(null)
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('')

  useEffect(() => {
    async function load() {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session!.user.id).maybeSingle()

      if (profile) {
        setDefaultMargin(String(profile.default_margin_percent))
        setHomeAddressId(profile.home_address_id)

        if (profile.home_address_id) {
          const { data: address } = await supabase
            .from('addresses')
            .select('*')
            .eq('id', profile.home_address_id)
            .single<Address>()
          if (address) {
            setLine1(address.line1)
            setLine2(address.line2 ?? '')
            setCity(address.city ?? '')
            setPostcode(address.postcode ?? '')
            setCountry(address.country ?? '')
          }
        }
      }

      setLoading(false)
    }

    load()
  }, [session])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    try {
      const userId = session!.user.id
      const addressId = await resolveAddressId(homeAddressId, { line1, line2, city, country, postcode }, userId)

      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: userId,
        default_margin_percent: Number(defaultMargin) || 0,
        home_address_id: addressId,
      })

      if (upsertError) throw upsertError

      setHomeAddressId(addressId)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <form className="job-form" onSubmit={handleSubmit}>
        <label>
          Default profit margin (%)
          <input
            type="number"
            step="0.01"
            min="0"
            value={defaultMargin}
            onChange={(e) => setDefaultMargin(e.target.value)}
          />
        </label>
        <p className="field-hint">
          Applied automatically to new material lines on a job. You can still override the margin on any individual
          line, or on the job itself.
        </p>

        <fieldset className="form-fieldset">
          <legend>Home base address (optional)</legend>
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
        {saved && <p className="form-info">Settings saved.</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

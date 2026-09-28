import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { findOrCreateByName } from '../lib/resolvers'
import { useAuth } from '../context/AuthContext'

interface PriceEntry {
  supplierName: string
  cost: number
  currencyCode: string
  recordedAt: string
}

interface MaterialRow {
  id: string
  name: string
  unit: string | null
  prices: PriceEntry[]
}

export default function MaterialsList() {
  const { session } = useAuth()
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [materialName, setMaterialName] = useState('')
  const [unit, setUnit] = useState('')
  const [savingMaterial, setSavingMaterial] = useState(false)

  const [priceForms, setPriceForms] = useState<Record<string, { supplier: string; cost: string }>>({})

  async function load() {
    setLoading(true)

    const { data: materialsData, error: materialsError } = await supabase
      .from('materials')
      .select('id, name, unit')
      .order('name')

    if (materialsError) {
      setError(materialsError.message)
      setLoading(false)
      return
    }

    const { data: pricesData, error: pricesError } = await supabase
      .from('material_latest_prices')
      .select('material_id, cost, currency_code, recorded_at, supplier:suppliers(name)')

    if (pricesError) {
      setError(pricesError.message)
      setLoading(false)
      return
    }

    const pricesByMaterial = new Map<string, PriceEntry[]>()
    for (const row of pricesData ?? []) {
      const list = pricesByMaterial.get(row.material_id) ?? []
      list.push({
        supplierName: (row.supplier as unknown as { name: string } | null)?.name ?? 'Unknown supplier',
        cost: row.cost,
        currencyCode: row.currency_code,
        recordedAt: row.recorded_at,
      })
      pricesByMaterial.set(row.material_id, list)
    }

    setMaterials(
      (materialsData ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        prices: pricesByMaterial.get(m.id) ?? [],
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAddMaterial(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSavingMaterial(true)

    const { error: insertError } = await supabase
      .from('materials')
      .insert({ user_id: session!.user.id, name: materialName.trim(), unit: unit.trim() || null })

    setSavingMaterial(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setMaterialName('')
    setUnit('')
    await load()
  }

  async function handleAddPrice(materialId: string) {
    const form = priceForms[materialId]
    if (!form?.supplier.trim() || !form.cost) return

    setError(null)

    try {
      const userId = session!.user.id
      const supplierId = await findOrCreateByName('suppliers', form.supplier, userId)

      const { error: insertError } = await supabase.from('material_prices').insert({
        user_id: userId,
        material_id: materialId,
        supplier_id: supplierId,
        cost: Number(form.cost),
      })

      if (insertError) throw insertError

      setPriceForms((forms) => ({ ...forms, [materialId]: { supplier: '', cost: '' } }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save price.')
    }
  }

  async function handleDeleteMaterial(id: string) {
    if (!confirm('Delete this material? Its price history will be removed too.')) return
    const { error } = await supabase.from('materials').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Materials</h1>
      </header>

      <form className="job-form" onSubmit={handleAddMaterial} style={{ marginBottom: '1.5rem' }}>
        <label>
          Material name *
          <input required value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
        </label>
        <label>
          Unit
          <input placeholder="e.g. kg, m, each" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={savingMaterial}>
            {savingMaterial ? 'Saving…' : 'Add material'}
          </button>
        </div>
      </form>

      {loading && <p>Loading…</p>}
      {!loading && materials.length === 0 && <p className="empty-state">No materials yet.</p>}

      <div className="material-list">
        {materials.map((material) => (
          <div className="material-card" key={material.id}>
            <div className="material-card-header">
              <div>
                <span className="job-name">{material.name}</span>
                {material.unit && <span className="material-unit"> / {material.unit}</span>}
              </div>
              <button className="link-button" onClick={() => handleDeleteMaterial(material.id)}>
                Delete
              </button>
            </div>

            {material.prices.length > 0 && (
              <table className="line-items-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Cost</th>
                    <th>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {material.prices.map((price, i) => (
                    <tr key={i}>
                      <td>{price.supplierName}</td>
                      <td>{price.cost.toLocaleString(undefined, { style: 'currency', currency: price.currencyCode })}</td>
                      <td>{new Date(price.recordedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="line-item-row" style={{ gridTemplateColumns: '1fr 100px auto' }}>
              <input
                placeholder="Supplier name"
                value={priceForms[material.id]?.supplier ?? ''}
                onChange={(e) =>
                  setPriceForms((forms) => ({
                    ...forms,
                    [material.id]: { supplier: e.target.value, cost: forms[material.id]?.cost ?? '' },
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cost"
                value={priceForms[material.id]?.cost ?? ''}
                onChange={(e) =>
                  setPriceForms((forms) => ({
                    ...forms,
                    [material.id]: { supplier: forms[material.id]?.supplier ?? '', cost: e.target.value },
                  }))
                }
              />
              <button type="button" className="link-button" onClick={() => handleAddPrice(material.id)}>
                + Add price
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

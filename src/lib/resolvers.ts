import { supabase } from './supabase'

export async function findOrCreateByName(
  table: 'clients' | 'suppliers',
  name: string,
  userId: string,
): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const { data: existing, error: lookupError } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing) return existing.id

  const { data: created, error: insertError } = await supabase
    .from(table)
    .insert({ user_id: userId, name: trimmed })
    .select('id')
    .single()

  if (insertError) throw insertError
  return created.id
}

export interface AddressFields {
  line1: string
  line2: string
  city: string
  country: string
  postcode: string
}

export async function resolveAddressId(
  existingId: string | null,
  fields: AddressFields,
  userId: string,
): Promise<string | null> {
  const hasAny = Object.values(fields).some((v) => v.trim())
  if (!hasAny) return null

  if (!fields.line1.trim()) {
    throw new Error('Address line 1 is required if you enter any other address field.')
  }

  const payload = {
    user_id: userId,
    line1: fields.line1.trim(),
    line2: fields.line2.trim() || null,
    city: fields.city.trim() || null,
    country: fields.country.trim() || null,
    postcode: fields.postcode.trim() || null,
  }

  if (existingId) {
    const { error } = await supabase.from('addresses').update(payload).eq('id', existingId)
    if (error) throw error
    return existingId
  }

  const { data, error } = await supabase.from('addresses').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

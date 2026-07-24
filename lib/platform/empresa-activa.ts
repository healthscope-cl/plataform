import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mapEmpresaRow, type Empresa } from './types'

export const COOKIE_EMPRESA_ACTIVA = 'empresa_activa'

export async function getEmpresaActiva(supabase: SupabaseClient): Promise<Empresa | null> {
  const { data: empresaRows } = await supabase.from('empresas').select('*')
  const empresas = (empresaRows ?? []).map(mapEmpresaRow)
  if (empresas.length === 0) return null

  const cookieStore = await cookies()
  const empresaIdCookie = cookieStore.get(COOKIE_EMPRESA_ACTIVA)?.value
  const activa = empresaIdCookie ? empresas.find((empresa) => empresa.id === empresaIdCookie) : undefined

  return activa ?? empresas[0]
}

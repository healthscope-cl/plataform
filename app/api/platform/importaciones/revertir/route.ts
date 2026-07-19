import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/platform/roles'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('usuarios')
    .select('tenant_id, estado, roles(clave)')
    .eq('id', user.id)
    .single()
  if (!caller) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 })
  }
  const rolClave = (caller.roles as unknown as { clave: string }).clave
  if (!isAdminRole(rolClave) || caller.estado !== 'activo') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }
  const tenantId = caller.tenant_id as string

  const { importacionId } = (await request.json()) as { importacionId: string }
  const admin = createAdminClient()

  const { data: importacion } = await admin
    .from('importaciones')
    .select('*')
    .eq('id', importacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (!importacion) {
    return NextResponse.json({ error: 'Importación no encontrada.' }, { status: 404 })
  }

  const { data: episodiosDeLaImportacion } = await admin
    .from('episodios')
    .select('id, persona_id')
    .eq('importacion_id', importacionId)

  const personaIds = Array.from(new Set((episodiosDeLaImportacion ?? []).map((e) => e.persona_id as string)))

  await admin.from('episodios').delete().eq('importacion_id', importacionId)

  for (const personaId of personaIds) {
    const { count } = await admin
      .from('episodios')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
    if ((count ?? 0) === 0) {
      await admin.from('personas').delete().eq('id', personaId)
    }
  }

  await admin.from('importaciones').update({ estado: 'revertida' }).eq('id', importacionId)

  return NextResponse.json({ ok: true })
}

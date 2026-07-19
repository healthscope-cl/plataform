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

  if (importacion.estado !== 'completada') {
    const mensaje =
      importacion.estado === 'revertida'
        ? 'Esta importación ya fue revertida.'
        : importacion.estado === 'en_progreso'
          ? 'No se puede revertir una importación que aún está en progreso.'
          : 'Solo se pueden revertir importaciones completadas.'
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }

  const { data: episodiosDeLaImportacion } = await admin
    .from('episodios')
    .select('id, persona_id')
    .eq('importacion_id', importacionId)

  const personaIds = Array.from(new Set((episodiosDeLaImportacion ?? []).map((e) => e.persona_id as string)))

  const { error: episodiosDeleteError } = await admin.from('episodios').delete().eq('importacion_id', importacionId)

  if (episodiosDeleteError) {
    return NextResponse.json(
      { error: `No se pudieron eliminar los episodios: ${episodiosDeleteError.message}` },
      { status: 500 }
    )
  }

  const personaDeleteErrors: string[] = []

  for (const personaId of personaIds) {
    const { count } = await admin
      .from('episodios')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
    if ((count ?? 0) === 0) {
      const { error: personaDeleteError } = await admin.from('personas').delete().eq('id', personaId)
      if (personaDeleteError) {
        personaDeleteErrors.push(`${personaId}: ${personaDeleteError.message}`)
      }
    }
  }

  const { error: importacionUpdateError } = await admin
    .from('importaciones')
    .update({ estado: 'revertida' })
    .eq('id', importacionId)

  if (importacionUpdateError) {
    return NextResponse.json(
      { error: `Los episodios fueron eliminados pero no se pudo actualizar el estado de la importación: ${importacionUpdateError.message}` },
      { status: 500 }
    )
  }

  if (personaDeleteErrors.length > 0) {
    return NextResponse.json({
      ok: true,
      advertencia: 'Algunas personas no pudieron eliminarse.',
      personasNoEliminadas: personaDeleteErrors,
    })
  }

  return NextResponse.json({ ok: true })
}

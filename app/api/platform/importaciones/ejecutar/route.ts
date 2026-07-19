import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/platform/roles'
import { clasificarEpisodio } from '@/lib/ingestion/classification'
import { hashRut } from '@/lib/ingestion/rutHash'
import type { MappedRow } from '@/lib/ingestion/validate'
import type { TipoAdministrativoClave } from '@/lib/ingestion/types'

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
    .select('tenant_id, roles(clave)')
    .eq('id', user.id)
    .single()
  if (!caller) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 })
  }
  const rolClave = (caller.roles as unknown as { clave: string }).clave
  if (!isAdminRole(rolClave)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }
  const tenantId = caller.tenant_id as string

  const body = (await request.json()) as {
    archivoNombre: string
    archivoHash: string
    empresaId: string
    forzarReimportacion?: boolean
    rows: Array<MappedRow & { codigoPersona: string | null }>
  }

  const admin = createAdminClient()

  const { data: archivoRepetido } = await admin
    .from('importaciones')
    .select('id, created_at')
    .eq('tenant_id', tenantId)
    .eq('archivo_hash', body.archivoHash)
    .neq('estado', 'revertida')
    .maybeSingle()

  if (archivoRepetido && !body.forzarReimportacion) {
    return NextResponse.json(
      {
        error: 'archivo_repetido',
        importacionExistente: archivoRepetido.id,
        mensaje: `Este archivo ya fue importado el ${new Date(archivoRepetido.created_at).toLocaleDateString('es-CL')}. Vuelve a intentarlo confirmando la reimportación si es intencional.`,
      },
      { status: 409 }
    )
  }

  const { data: importacion, error: importacionError } = await admin
    .from('importaciones')
    .insert({
      tenant_id: tenantId,
      responsable_id: user.id,
      archivo_nombre: body.archivoNombre,
      archivo_hash: body.archivoHash,
      estado: 'en_progreso',
    })
    .select()
    .single()

  if (importacionError || !importacion) {
    return NextResponse.json({ error: importacionError?.message ?? 'No se pudo crear la importación.' }, { status: 500 })
  }

  let filasProcesadas = 0
  let filasRechazadas = 0
  const episodiosPreviosPorRut = new Map<string, number>()

  for (const row of body.rows) {
    if (!row.rut || !row.fechaInicio || !row.dias || !row.tipoAdministrativo) {
      filasRechazadas += 1
      continue
    }

    const rutHash = await hashRut(row.rut)

    const { data: existingPersona } = await admin
      .from('personas')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('rut_hash', rutHash)
      .maybeSingle()

    let personaId = existingPersona?.id as string | undefined
    if (!personaId) {
      const { data: newPersona, error: personaError } = await admin
        .from('personas')
        .insert({
          tenant_id: tenantId,
          empresa_id: body.empresaId,
          codigo: row.codigoPersona ?? rutHash.slice(0, 8),
          rut_hash: rutHash,
        })
        .select()
        .single()
      if (personaError || !newPersona) {
        filasRechazadas += 1
        continue
      }
      personaId = newPersona.id as string
    }

    const { data: tipo } = await admin
      .from('tipos_administrativos')
      .select('id')
      .eq('clave', row.tipoAdministrativo)
      .single()
    if (!tipo) {
      filasRechazadas += 1
      continue
    }

    const episodiosPrevios12Meses = episodiosPreviosPorRut.get(rutHash) ?? 0
    const clasificacion = clasificarEpisodio({
      tipoAdministrativo: row.tipoAdministrativo as TipoAdministrativoClave,
      dias: row.dias,
      episodiosPrevios12Meses,
    })
    episodiosPreviosPorRut.set(rutHash, episodiosPrevios12Meses + 1)

    const { error: episodioError } = await admin.from('episodios').insert({
      tenant_id: tenantId,
      persona_id: personaId,
      importacion_id: importacion.id,
      tipo_administrativo_id: tipo.id,
      fecha_inicio: row.fechaInicio,
      fecha_fin: row.fechaFin ?? null,
      dias: row.dias,
      clasificacion_analitica: clasificacion,
    })

    if (episodioError) {
      filasRechazadas += 1
      continue
    }

    filasProcesadas += 1
  }

  await admin
    .from('importaciones')
    .update({ estado: 'completada', filas_procesadas: filasProcesadas, filas_rechazadas: filasRechazadas })
    .eq('id', importacion.id)

  return NextResponse.json({ importacionId: importacion.id, filasProcesadas, filasRechazadas })
}

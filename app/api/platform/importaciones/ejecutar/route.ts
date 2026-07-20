import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/platform/roles'
import { clasificarEpisodio } from '@/lib/ingestion/classification'
import { hashRut } from '@/lib/ingestion/rutHash'
import { validateRows, type MappedRow } from '@/lib/ingestion/validate'
import type { TipoAdministrativoClave } from '@/lib/ingestion/types'
import { resolveIdPorNombre, resolveUnidadId } from '@/lib/ingestion/groupMatching'

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

  const body = (await request.json()) as {
    archivoNombre: string
    archivoHash: string
    empresaId: string
    forzarReimportacion?: boolean
    rows: Array<
      MappedRow & {
        codigoPersona: string | null
        sucursal: string | null
        unidad: string | null
        cargo: string | null
        turno: string | null
      }
    >
  }

  const admin = createAdminClient()

  const { data: empresaValida } = await admin
    .from('empresas')
    .select('id')
    .eq('id', body.empresaId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!empresaValida) {
    return NextResponse.json({ error: 'Empresa no encontrada para este tenant.' }, { status: 400 })
  }

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

  const { data: tiposAdministrativos } = await admin.from('tipos_administrativos').select('id, clave')
  const tiposValidos = (tiposAdministrativos ?? []).map((tipo) => tipo.clave as string)
  const tipoIdPorClave = new Map<string, string>(
    (tiposAdministrativos ?? []).map((tipo) => [tipo.clave as string, tipo.id as string])
  )

  const { data: sucursalRows } = await admin
    .from('sucursales')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const sucursalIds = sucursales.map((s) => s.id)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await admin
          .from('unidades')
          .select('id, nombre, sucursal_id')
          .eq('tenant_id', tenantId)
          .in('sucursal_id', sucursalIds)
      : { data: [] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: cargoRows } = await admin
    .from('cargos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: turnoRows } = await admin
    .from('turnos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
  const turnos = (turnoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const advertenciasGrupo: Array<{
    tenant_id: string
    importacion_id: string
    fila: number
    severidad: 'advertencia'
    tipo: string
    mensaje: string
  }> = []

  const validation = validateRows({ rows: body.rows, tiposValidos })

  const erroresCalidadRows = Array.from(validation.filaErrors.entries()).flatMap(([fila, errors]) =>
    errors.map((error) => ({
      tenant_id: tenantId,
      importacion_id: importacion.id,
      fila,
      severidad: error.severidad,
      tipo: error.tipo,
      mensaje: error.mensaje,
    }))
  )

  if (erroresCalidadRows.length > 0) {
    await admin.from('errores_calidad').insert(erroresCalidadRows)
  }

  let filasProcesadas = 0
  let filasRechazadas = 0
  const episodiosPreviosPorRut = new Map<string, number>()

  for (const [index, row] of body.rows.entries()) {
    const tieneCritico = validation.filaErrors.get(index)?.some((error) => error.severidad === 'critico') ?? false
    if (tieneCritico) {
      filasRechazadas += 1
      continue
    }

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
      const unidadId = resolveUnidadId(row.unidad, row.sucursal, sucursales, unidades)
      if (row.unidad && !unidadId) {
        advertenciasGrupo.push({
          tenant_id: tenantId,
          importacion_id: importacion.id,
          fila: index,
          severidad: 'advertencia',
          tipo: 'grupo_no_reconocido',
          mensaje: `La unidad "${row.unidad}" no existe en el catálogo; la persona quedará sin unidad asignada.`,
        })
      }

      const cargoId = resolveIdPorNombre(row.cargo, cargos)
      if (row.cargo && !cargoId) {
        advertenciasGrupo.push({
          tenant_id: tenantId,
          importacion_id: importacion.id,
          fila: index,
          severidad: 'advertencia',
          tipo: 'grupo_no_reconocido',
          mensaje: `El cargo "${row.cargo}" no existe en el catálogo; la persona quedará sin cargo asignado.`,
        })
      }

      const turnoId = resolveIdPorNombre(row.turno, turnos)
      if (row.turno && !turnoId) {
        advertenciasGrupo.push({
          tenant_id: tenantId,
          importacion_id: importacion.id,
          fila: index,
          severidad: 'advertencia',
          tipo: 'grupo_no_reconocido',
          mensaje: `El turno "${row.turno}" no existe en el catálogo; la persona quedará sin turno asignado.`,
        })
      }

      const { data: newPersona, error: personaError } = await admin
        .from('personas')
        .insert({
          tenant_id: tenantId,
          empresa_id: body.empresaId,
          codigo: row.codigoPersona ?? rutHash.slice(0, 8),
          rut_hash: rutHash,
          unidad_id: unidadId,
          cargo_id: cargoId,
          turno_id: turnoId,
        })
        .select()
        .single()
      if (personaError || !newPersona) {
        filasRechazadas += 1
        continue
      }
      personaId = newPersona.id as string
    }

    const tipoId = tipoIdPorClave.get(row.tipoAdministrativo)
    if (!tipoId) {
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
      tipo_administrativo_id: tipoId,
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

  if (advertenciasGrupo.length > 0) {
    await admin.from('errores_calidad').insert(advertenciasGrupo)
  }

  await admin
    .from('importaciones')
    .update({
      estado: 'completada',
      filas_procesadas: filasProcesadas,
      filas_rechazadas: filasRechazadas,
      advertencias: validation.resumen.advertencias + advertenciasGrupo.length,
    })
    .eq('id', importacion.id)

  return NextResponse.json({ importacionId: importacion.id, filasProcesadas, filasRechazadas })
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { mapImportacionRow, mapErrorCalidadRow } from '@/lib/ingestion/types'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { CalidadDatosResumen } from '@/components/platform/calidad-datos/CalidadDatosResumen'
import { CalidadDatosTable, type ErrorCalidadFila } from '@/components/platform/calidad-datos/CalidadDatosTable'

const ESTADO_LABELS: Record<'en_progreso' | 'completada' | 'revertida' | 'fallida', string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  revertida: 'Revertida',
  fallida: 'Fallida',
}

export default async function CalidadDatosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id, tenant_id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const empresa = await getEmpresaActiva(supabase)

  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  let indiceSuficiencia = null
  if (empresa) {
    const { data: personaRows } = await supabase
      .from('personas')
      .select('id, unidad_id, cargo_id, turno_id')
      .eq('empresa_id', empresa.id)
    const personas = (personaRows ?? []).map((row) => ({
      id: row.id as string,
      unidadId: row.unidad_id as string | null,
      cargoId: row.cargo_id as string | null,
      turnoId: row.turno_id as string | null,
    }))
    const personaIds = personas.map((p) => p.id)

    const { count: cantidadEpisodios } =
      personaIds.length > 0
        ? await supabase
            .from('episodios')
            .select('id', { count: 'exact', head: true })
            .in('persona_id', personaIds)
            .gte('fecha_inicio', periodoInicio)
        : { count: 0 }

    const { data: importacionReciente } = await supabase
      .from('importaciones')
      .select('id')
      .eq('tenant_id', usuarioRow.tenant_id as string)
      .eq('estado', 'completada')
      .gte('created_at', periodoInicio)
      .limit(1)

    indiceSuficiencia = calcularIndiceSuficiencia({
      personas,
      cantidadEpisodios: cantidadEpisodios ?? 0,
      huboImportacionReciente: (importacionReciente ?? []).length > 0,
    })
  }

  const { data: importacionRows } = await supabase
    .from('importaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  const importaciones = (importacionRows ?? []).map(mapImportacionRow)
  const importacionIds = importaciones.map((i) => i.id)

  const { data: errorRows } =
    importacionIds.length > 0
      ? await supabase.from('errores_calidad').select('*').in('importacion_id', importacionIds)
      : { data: [] }
  const errores = (errorRows ?? []).map(mapErrorCalidadRow)

  const erroresFilas: ErrorCalidadFila[] = errores
    .map((error) => {
      const importacion = importaciones.find((i) => i.id === error.importacionId)
      return {
        id: error.id,
        fecha: importacion?.createdAt ?? '',
        archivo: importacion?.archivoNombre ?? '',
        fila: error.fila,
        severidad: error.severidad,
        tipo: error.tipo,
        mensaje: error.mensaje,
      }
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .slice(0, 200)

  const ultimaImportacion = importaciones[0]

  return (
    <div className="space-y-6">
      {indiceSuficiencia ? <SuficienciaBanner indice={indiceSuficiencia} /> : null}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Calidad de datos</h1>
        {ultimaImportacion ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Última importación: {new Date(ultimaImportacion.createdAt).toLocaleDateString('es-CL')} —{' '}
            {ultimaImportacion.archivoNombre} — {ESTADO_LABELS[ultimaImportacion.estado]}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Todavía no se ha realizado ninguna importación.</p>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Resumen por tipo</h2>
        <CalidadDatosResumen errores={errores} />
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Detalle</h2>
        <CalidadDatosTable errores={erroresFilas} />
      </div>
    </div>
  )
}

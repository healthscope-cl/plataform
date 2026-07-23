import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow, mapErrorCalidadRow } from '@/lib/ingestion/types'
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

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

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

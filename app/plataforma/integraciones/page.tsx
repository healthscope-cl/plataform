import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow } from '@/lib/ingestion/types'
import { Badge } from '@/components/ui/badge'

const ESTADO_LABELS: Record<string, string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  revertida: 'Revertida',
  fallida: 'Fallida',
}

const FUENTES_NO_CONFIGURADAS = [
  {
    nombre: 'HRIS',
    descripcion:
      'Se conecta mediante una exportación periódica autorizada del sistema de Recursos Humanos del cliente — no acceso directo a su base de datos.',
  },
  {
    nombre: 'ERP',
    descripcion:
      'Requiere una integración autorizada con el ERP del cliente (exportación de asistencia, turnos u otros datos relevantes) — no acceso directo.',
  },
  {
    nombre: 'API',
    descripcion:
      'Requiere una API contratada y autorizada explícitamente por el cliente — HealthScope no expone ni consume APIs sin esa autorización.',
  },
  {
    nombre: 'IMED',
    descripcion:
      'Nunca acceso directo a la base de IMED — solo mediante exportación autorizada del empleador o datos clínicos agregados enviados por el prestador.',
  },
  {
    nombre: 'Medipass',
    descripcion:
      'Mismo principio que IMED — nunca acceso directo, solo exportación autorizada o datos agregados del prestador.',
  },
  {
    nombre: 'Sistemas propios',
    descripcion:
      'Se evalúa caso a caso según qué pueda exportar de forma segura el sistema propio del cliente (típicamente Excel/CSV o una API contratada).',
  },
] as const

export default async function IntegracionesPage() {
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
  const importaciones = (importacionRows ?? []).map(mapImportacionRow)

  const totalImportaciones = importaciones.length
  const totalFilasProcesadas = importaciones.reduce((acc, imp) => acc + imp.filasProcesadas, 0)
  const ultimaImportacion = importaciones[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Integraciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado de las fuentes de datos que HealthScope puede recibir.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Excel / CSV</p>
            <Badge variant="secondary">Activa</Badge>
          </div>
          <p className="mt-2 text-sm text-foreground">{totalImportaciones} importaciones realizadas</p>
          <p className="text-sm text-foreground">{totalFilasProcesadas} filas procesadas en total</p>
          {ultimaImportacion ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Última: {new Date(ultimaImportacion.createdAt).toLocaleDateString('es-CL')} —{' '}
              {ultimaImportacion.archivoNombre} — {ESTADO_LABELS[ultimaImportacion.estado] ?? ultimaImportacion.estado}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Todavía no se ha realizado ninguna importación.</p>
          )}
        </div>

        {FUENTES_NO_CONFIGURADAS.map((fuente) => (
          <div key={fuente.nombre} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{fuente.nombre}</p>
              <Badge variant="outline">No configurada</Badge>
            </div>
            <p className="mt-2 text-sm text-foreground">{fuente.descripcion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

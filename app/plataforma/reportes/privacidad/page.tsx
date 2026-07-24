import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { MIN_GROUP_SIZE } from '@/lib/indicators/formulas'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ReportePrivacidadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)

  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase.from('personas').select('id').eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({ id: row.id as string, contratoDias: 180 }))
  const personaIds = personas.map((p) => p.id)

  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('persona_id, dias, estado')
          .in('persona_id', personaIds)
          .gte('fecha_inicio', periodoInicio)
      : { data: [] }
  const episodios = (episodioRows ?? []).map((row) => ({
    personaId: row.persona_id as string,
    dias: row.dias as number,
    estado: row.estado as 'abierto' | 'cerrado',
  }))

  const indicadores = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })
  const cantidadSuprimidos = Object.values(indicadores).filter((valor) => 'suprimido' in valor).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Privacidad</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Principios de privacidad aplicados</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>
            Tamaño mínimo de grupo: ningún indicador o resultado agregado se muestra si representa a menos de{' '}
            {MIN_GROUP_SIZE} personas o respuestas.
          </li>
          <li>Separación administrativa y clínica: el tipo de licencia registrado nunca es un diagnóstico ni un código clínico.</li>
          <li>Pseudonimización: el RUT de cada persona nunca se almacena en texto plano, solo un hash de un solo sentido.</li>
          <li>Auditoría de solo escritura: todas las acciones administrativas quedan registradas y no pueden modificarse ni eliminarse.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Indicadores actualmente suprimidos por grupo insuficiente</p>
        <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{cantidadSuprimidos} de 6</p>
      </div>

      <Link href="/plataforma/auditoria" className="text-sm text-primary underline">
        Ver registro de auditoría
      </Link>
    </div>
  )
}

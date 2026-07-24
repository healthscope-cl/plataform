import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow, mapRolRow } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { IndicadoresResumenTabla } from '@/components/platform/reportes/IndicadoresResumenTabla'
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ReporteRecursosHumanosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const rol = mapRolRow(usuarioRow.roles)
  if (!isAdminRole(rol.clave)) {
    return <p className="text-muted-foreground">Este reporte requiere permisos de administrador.</p>
  }

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase.from('personas').select('id, codigo, unidad_id, cargo_id, turno_id').eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({
    id: row.id as string,
    codigo: row.codigo as string,
    contratoDias: 180,
    unidadId: row.unidad_id as string | null,
    cargoId: row.cargo_id as string | null,
    turnoId: row.turno_id as string | null,
  }))
  const personaIds = personas.map((p) => p.id)

  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('persona_id, dias, estado, tipo_administrativo_id')
          .in('persona_id', personaIds)
          .gte('fecha_inicio', periodoInicio)
      : { data: [] }
  const episodios = (episodioRows ?? []).map((row) => ({
    personaId: row.persona_id as string,
    dias: row.dias as number,
    estado: row.estado as 'abierto' | 'cerrado',
    tipoAdministrativoId: row.tipo_administrativo_id as string,
  }))

  const { data: importacionReciente } = await supabase
    .from('importaciones')
    .select('id')
    .eq('estado', 'completada')
    .gte('created_at', periodoInicio)
    .limit(1)
  const huboImportacionReciente = (importacionReciente ?? []).length > 0

  const indiceSuficiencia = calcularIndiceSuficiencia({
    personas,
    cantidadEpisodios: episodios.length,
    huboImportacionReciente,
  })

  const indicadores = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })

  const indicadoresPorPersona = computeIndicadoresPorPersona({
    personas,
    episodios,
    costoPromedioDiario: COSTOS_DEFAULT.costoPromedioDiario,
  }).sort((a, b) => b.costoEstimado - a.costoEstimado)

  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const conteoPorTipo = new Map<string, number>()
  for (const episodio of episodios) {
    conteoPorTipo.set(episodio.tipoAdministrativoId, (conteoPorTipo.get(episodio.tipoAdministrativoId) ?? 0) + 1)
  }
  const distribucionPorTipo = Array.from(conteoPorTipo.entries())
    .map(([tipoId, cantidad]) => ({
      nombre: tipos.find((t) => t.id === tipoId)?.nombre ?? tipoId,
      cantidad,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Recursos Humanos</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFin}
        </p>
      </div>

      <SuficienciaBanner indice={indiceSuficiencia} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Indicadores clave</h2>
        <IndicadoresResumenTabla indicadores={indicadores} />
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Distribución por tipo de licencia</h2>
        {distribucionPorTipo.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin episodios en el período.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {distribucionPorTipo.map((item) => (
              <li key={item.nombre}>
                {item.nombre}: {item.cantidad}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Costo por persona</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Días perdidos</TableHead>
              <TableHead>Episodios</TableHead>
              <TableHead>Costo estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicadoresPorPersona.map((persona) => (
              <TableRow key={persona.id}>
                <TableCell>{persona.codigo}</TableCell>
                <TableCell>{persona.diasPerdidos}</TableCell>
                <TableCell>{persona.cantidadEpisodios}</TableCell>
                <TableCell>${persona.costoEstimado.toLocaleString('es-CL')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

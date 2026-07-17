import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  mapSucursalRow,
  mapUnidadRow,
  mapCentroCostoRow,
  mapCargoRow,
  mapTurnoRow,
  mapUsuarioRow,
  mapRolRow,
} from '@/lib/platform/types'
import { SucursalesTable } from '@/components/platform/SucursalesTable'
import { UnidadesTable } from '@/components/platform/UnidadesTable'
import { CentrosCostoTable } from '@/components/platform/CentrosCostoTable'
import { CargosTable } from '@/components/platform/CargosTable'
import { TurnosTable } from '@/components/platform/TurnosTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function OrganizacionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()
  if (!usuarioRow) redirect('/login')

  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const [sucursalesRes, centrosCostoRes, cargosRes, turnosRes] = await Promise.all([
    supabase.from('sucursales').select('*').eq('empresa_id', empresaId),
    supabase.from('centros_costo').select('*').eq('empresa_id', empresaId),
    supabase.from('cargos').select('*').eq('empresa_id', empresaId),
    supabase.from('turnos').select('*').eq('empresa_id', empresaId),
  ])

  const sucursales = (sucursalesRes.data ?? []).map(mapSucursalRow)
  const centrosCosto = (centrosCostoRes.data ?? []).map(mapCentroCostoRow)
  const cargos = (cargosRes.data ?? []).map(mapCargoRow)
  const turnos = (turnosRes.data ?? []).map(mapTurnoRow)

  const primerSucursalId = sucursales[0]?.id
  const { data: unidadRows } = primerSucursalId
    ? await supabase.from('unidades').select('*').eq('sucursal_id', primerSucursalId)
    : { data: [] }
  const unidades = (unidadRows ?? []).map(mapUnidadRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Organización</h1>
      <Tabs defaultValue="sucursales">
        <TabsList>
          <TabsTrigger value="sucursales">Sucursales</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="centros-costo">Centros de costo</TabsTrigger>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="turnos">Turnos</TabsTrigger>
        </TabsList>
        <TabsContent value="sucursales">
          <SucursalesTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialSucursales={sucursales}
          />
        </TabsContent>
        <TabsContent value="unidades">
          {primerSucursalId ? (
            <UnidadesTable
              tenantId={usuario.tenantId}
              sucursalId={primerSucursalId}
              actorId={usuario.id}
              rolClave={rol.clave}
              initialUnidades={unidades}
            />
          ) : (
            <p className="text-muted-foreground">Crea una sucursal primero.</p>
          )}
        </TabsContent>
        <TabsContent value="centros-costo">
          <CentrosCostoTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialCentrosCosto={centrosCosto}
          />
        </TabsContent>
        <TabsContent value="cargos">
          <CargosTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialCargos={cargos}
          />
        </TabsContent>
        <TabsContent value="turnos">
          <TurnosTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialTurnos={turnos}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

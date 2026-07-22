'use client'

import { useMemo, useState } from 'react'
import { computeIndicadores, type IndicadorResultados } from '@/lib/indicators/aggregate'
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { filtrarPersonas, type FiltroGrupo } from '@/lib/indicators/filtroPersonas'
import { cambio, type IndicadorValor } from '@/lib/indicators/formulas'
import { IndicadorCard } from '@/components/platform/dashboard/IndicadorCard'
import { PersonaDetalleTable } from '@/components/platform/dashboard/PersonaDetalleTable'
import { GuardarLineaBaseButton } from '@/components/platform/dashboard/GuardarLineaBaseButton'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const FILTRO_VACIO: FiltroGrupo = { sucursalId: null, unidadId: null, cargoId: null, turnoId: null }

type Persona = {
  id: string
  codigo: string
  contratoDias: number
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
}
type Episodio = { personaId: string; dias: number; estado: 'abierto' | 'cerrado' }
type CatalogoItem = { id: string; nombre: string }
type UnidadItem = { id: string; nombre: string; sucursalId: string }
type Costos = { costoPromedioDiario: number; horasExtra: number; reemplazos: number; costosAdministrativos: number }

export function ResumenInteractivo({
  personas,
  episodios,
  sucursales,
  unidades,
  cargos,
  turnos,
  costos,
  indicadoresBase,
  periodoInicio,
  periodoFin,
  tenantId,
  empresaId,
  actorId,
  rolClave,
}: {
  personas: Persona[]
  episodios: Episodio[]
  sucursales: CatalogoItem[]
  unidades: UnidadItem[]
  cargos: CatalogoItem[]
  turnos: CatalogoItem[]
  costos: Costos
  indicadoresBase: IndicadorResultados | undefined
  periodoInicio: string
  periodoFin: string
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
}) {
  const [filtro, setFiltro] = useState<FiltroGrupo>(FILTRO_VACIO)
  const hayFiltroActivo = Boolean(filtro.sucursalId || filtro.unidadId || filtro.cargoId || filtro.turnoId)

  const personasFiltradas = useMemo(() => filtrarPersonas(personas, filtro, unidades), [personas, filtro, unidades])
  const personaIdsFiltrados = useMemo(() => new Set(personasFiltradas.map((p) => p.id)), [personasFiltradas])
  const episodiosFiltrados = useMemo(
    () => episodios.filter((episodio) => personaIdsFiltrados.has(episodio.personaId)),
    [episodios, personaIdsFiltrados]
  )

  const resultados = useMemo(
    () => computeIndicadores({ personas: personasFiltradas, episodios: episodiosFiltrados, costos }),
    [personasFiltradas, episodiosFiltrados, costos]
  )

  const resultadosSinFiltro = useMemo(
    () => computeIndicadores({ personas, episodios, costos }),
    [personas, episodios, costos]
  )

  const personasIndicador = useMemo(
    () =>
      computeIndicadoresPorPersona({
        personas: personasFiltradas,
        episodios: episodiosFiltrados,
        costoPromedioDiario: costos.costoPromedioDiario,
      }),
    [personasFiltradas, episodiosFiltrados, costos.costoPromedioDiario]
  )

  const unidadesDisponibles = useMemo(
    () => (filtro.sucursalId ? unidades.filter((u) => u.sucursalId === filtro.sucursalId) : unidades),
    [unidades, filtro.sucursalId]
  )

  function valorNumerico(resultado: IndicadorValor): number | null {
    return 'suprimido' in resultado ? null : resultado.valor
  }

  function cambioDe(clave: keyof IndicadorResultados): IndicadorValor | null {
    if (hayFiltroActivo || !indicadoresBase) return null
    return cambio({
      valorActual: valorNumerico(resultados[clave]),
      valorLineaBase: valorNumerico(indicadoresBase[clave]),
    })
  }

  function actualizarFiltro(campo: keyof FiltroGrupo, valor: string | null) {
    setFiltro((anterior) => {
      const siguiente = { ...anterior, [campo]: valor }
      if (campo === 'sucursalId') siguiente.unidadId = null
      return siguiente
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-sucursal" className="text-sm text-muted-foreground">
              Sucursal
            </Label>
            <Select
              value={filtro.sucursalId ?? '__todas__'}
              onValueChange={(valor) => actualizarFiltro('sucursalId', valor === '__todas__' ? null : valor)}
            >
              <SelectTrigger id="filtro-sucursal" className="w-full">
                <SelectValue>
                  {(valor: string) =>
                    valor === '__todas__' ? 'Todas' : (sucursales.find((s) => s.id === valor)?.nombre ?? valor)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                {sucursales.map((sucursal) => (
                  <SelectItem key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-unidad" className="text-sm text-muted-foreground">
              Unidad
            </Label>
            <Select
              value={filtro.unidadId ?? '__todas__'}
              onValueChange={(valor) => actualizarFiltro('unidadId', valor === '__todas__' ? null : valor)}
            >
              <SelectTrigger id="filtro-unidad" className="w-full">
                <SelectValue>
                  {(valor: string) =>
                    valor === '__todas__' ? 'Todas' : (unidadesDisponibles.find((u) => u.id === valor)?.nombre ?? valor)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                {unidadesDisponibles.map((unidad) => (
                  <SelectItem key={unidad.id} value={unidad.id}>
                    {unidad.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-cargo" className="text-sm text-muted-foreground">
              Cargo
            </Label>
            <Select
              value={filtro.cargoId ?? '__todos__'}
              onValueChange={(valor) => actualizarFiltro('cargoId', valor === '__todos__' ? null : valor)}
            >
              <SelectTrigger id="filtro-cargo" className="w-full">
                <SelectValue>
                  {(valor: string) =>
                    valor === '__todos__' ? 'Todos' : (cargos.find((c) => c.id === valor)?.nombre ?? valor)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {cargos.map((cargo) => (
                  <SelectItem key={cargo.id} value={cargo.id}>
                    {cargo.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-turno" className="text-sm text-muted-foreground">
              Turno
            </Label>
            <Select
              value={filtro.turnoId ?? '__todos__'}
              onValueChange={(valor) => actualizarFiltro('turnoId', valor === '__todos__' ? null : valor)}
            >
              <SelectTrigger id="filtro-turno" className="w-full">
                <SelectValue>
                  {(valor: string) =>
                    valor === '__todos__' ? 'Todos' : (turnos.find((t) => t.id === valor)?.nombre ?? valor)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {turnos.map((turno) => (
                  <SelectItem key={turno.id} value={turno.id}>
                    {turno.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {hayFiltroActivo ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setFiltro(FILTRO_VACIO)}>
            Limpiar filtros
          </Button>
        ) : (
          <GuardarLineaBaseButton
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            rolClave={rolClave}
            periodoInicio={periodoInicio}
            periodoFin={periodoFin}
            indicadores={resultadosSinFiltro}
          />
        )}
      </div>

      {hayFiltroActivo ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
            {personasFiltradas.length} de {personas.length} personas
          </span>
          <span>La comparación con línea base solo está disponible sin filtros.</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{personas.length} personas activas.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo="Tasa de ausentismo"
          resultado={resultados.tasaAusentismo}
          sufijo="%"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Días programados"
          cambio={cambioDe('tasaAusentismo')}
        />
        <IndicadorCard
          titulo="Frecuencia"
          resultado={resultados.frecuencia}
          sufijo="%"
          etiquetaNumerador="Episodios"
          etiquetaDenominador="Dotación promedio"
          cambio={cambioDe('frecuencia')}
        />
        <IndicadorCard
          titulo="Severidad"
          resultado={resultados.severidad}
          sufijo=" días/episodio"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios"
          cambio={cambioDe('severidad')}
        />
        <IndicadorCard
          titulo="Duración promedio"
          resultado={resultados.duracionPromedio}
          sufijo=" días"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios cerrados"
          cambio={cambioDe('duracionPromedio')}
        />
        <IndicadorCard
          titulo="Reincidencia"
          resultado={resultados.reincidencia}
          sufijo="%"
          etiquetaNumerador="Personas con 2+ episodios"
          etiquetaDenominador="Personas con 1+ episodio"
          cambio={cambioDe('reincidencia')}
        />
        <IndicadorCard
          titulo="Costo estimado"
          resultado={resultados.costoEstimado}
          sufijo="$"
          etiquetaNumerador="Costo total"
          etiquetaDenominador="—"
          cambio={cambioDe('costoEstimado')}
        />
      </div>

      <PersonaDetalleTable rolClave={rolClave} personas={personasIndicador} />
    </div>
  )
}

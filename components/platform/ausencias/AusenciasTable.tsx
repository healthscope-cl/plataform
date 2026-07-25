'use client'

import { Fragment, useMemo, useState } from 'react'
import type { ClasificacionAnalitica, TipoAdministrativoClave } from '@/lib/ingestion/types'
import { accionSugerida } from '@/lib/ingestion/accionSugerida'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const CLASIFICACION_LABELS: Record<ClasificacionAnalitica, string> = {
  corto: 'Corto',
  mediano: 'Mediano',
  prolongado: 'Prolongado',
  recurrente: 'Recurrente',
  continuacion: 'Continuación',
  accidente: 'Accidente',
  enfermedad_profesional: 'Enfermedad profesional',
  maternal: 'Maternal',
  cuidado_familiar: 'Cuidado familiar',
  sin_clasificar: 'Sin clasificar',
  calidad_insuficiente: 'Calidad insuficiente',
}

export type EpisodioFila = {
  id: string
  personaCodigo: string
  tipoAdministrativoNombre: string
  tipoAdministrativoClave: TipoAdministrativoClave
  fechaInicio: string
  fechaFin: string | null
  dias: number
  estado: 'abierto' | 'cerrado'
  clasificacionAnalitica: ClasificacionAnalitica
  costoEstimadoPersona: number
}

export function AusenciasTable({ episodios }: { episodios: EpisodioFila[] }) {
  const [tipoFiltro, setTipoFiltro] = useState('__todos__')
  const [estadoFiltro, setEstadoFiltro] = useState('__todos__')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const tiposDisponibles = useMemo(
    () => Array.from(new Set(episodios.map((e) => e.tipoAdministrativoNombre))).sort(),
    [episodios]
  )

  const episodiosFiltrados = useMemo(
    () =>
      episodios.filter(
        (e) =>
          (tipoFiltro === '__todos__' || e.tipoAdministrativoNombre === tipoFiltro) &&
          (estadoFiltro === '__todos__' || e.estado === estadoFiltro)
      ),
    [episodios, tipoFiltro, estadoFiltro]
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filtro-tipo" className="text-sm text-muted-foreground">
            Tipo administrativo
          </Label>
          <Select value={tipoFiltro} onValueChange={(valor) => valor !== null && setTipoFiltro(valor)}>
            <SelectTrigger id="filtro-tipo" className="w-full">
              <SelectValue>{(valor: string) => (valor === '__todos__' ? 'Todos' : valor)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              {tiposDisponibles.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-estado" className="text-sm text-muted-foreground">
            Estado
          </Label>
          <Select value={estadoFiltro} onValueChange={(valor) => valor !== null && setEstadoFiltro(valor)}>
            <SelectTrigger id="filtro-estado" className="w-full">
              <SelectValue>
                {(valor: string) => (valor === '__todos__' ? 'Todos' : valor === 'abierto' ? 'Abierto' : 'Cerrado')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              <SelectItem value="abierto">Abierto</SelectItem>
              <SelectItem value="cerrado">Cerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {episodiosFiltrados.length} de {episodios.length} registros.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha inicio</TableHead>
            <TableHead>Fecha fin</TableHead>
            <TableHead>Días</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Clasificación</TableHead>
            <TableHead>Acción sugerida</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {episodiosFiltrados.map((episodio) => {
            const expandido = expandedId === episodio.id
            const plan = accionSugerida({
              tipoAdministrativo: episodio.tipoAdministrativoClave,
              clasificacionAnalitica: episodio.clasificacionAnalitica,
            })
            return (
              <Fragment key={episodio.id}>
                <TableRow>
                  <TableCell>{episodio.personaCodigo}</TableCell>
                  <TableCell>{episodio.tipoAdministrativoNombre}</TableCell>
                  <TableCell>{episodio.fechaInicio}</TableCell>
                  <TableCell>{episodio.fechaFin ?? '—'}</TableCell>
                  <TableCell>{episodio.dias}</TableCell>
                  <TableCell className="capitalize">{episodio.estado}</TableCell>
                  <TableCell>{CLASIFICACION_LABELS[episodio.clasificacionAnalitica]}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(expandido ? null : episodio.id)}
                    >
                      {expandido ? 'Ocultar plan' : 'Ver plan'}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandido ? (
                  <TableRow>
                    <TableCell colSpan={8} className="whitespace-normal bg-muted/30">
                      <div className="space-y-1.5 py-2 text-sm">
                        <p>
                          <span className="font-medium text-foreground">Acción sugerida:</span> {plan.accion}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Responsable:</span> {plan.responsable}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Costo estimado de la persona:</span> $
                          {episodio.costoEstimadoPersona.toLocaleString('es-CL')}
                        </p>
                        <p className="text-xs text-muted-foreground">{plan.limitaciones}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

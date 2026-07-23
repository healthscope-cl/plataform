'use client'

import { useMemo, useState } from 'react'
import type { ClasificacionAnalitica } from '@/lib/ingestion/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  fechaInicio: string
  fechaFin: string | null
  dias: number
  estado: 'abierto' | 'cerrado'
  clasificacionAnalitica: ClasificacionAnalitica
}

export function AusenciasTable({ episodios }: { episodios: EpisodioFila[] }) {
  const [tipoFiltro, setTipoFiltro] = useState('__todos__')
  const [estadoFiltro, setEstadoFiltro] = useState('__todos__')

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
          </TableRow>
        </TableHeader>
        <TableBody>
          {episodiosFiltrados.map((episodio) => (
            <TableRow key={episodio.id}>
              <TableCell>{episodio.personaCodigo}</TableCell>
              <TableCell>{episodio.tipoAdministrativoNombre}</TableCell>
              <TableCell>{episodio.fechaInicio}</TableCell>
              <TableCell>{episodio.fechaFin ?? '—'}</TableCell>
              <TableCell>{episodio.dias}</TableCell>
              <TableCell className="capitalize">{episodio.estado}</TableCell>
              <TableCell>{CLASIFICACION_LABELS[episodio.clasificacionAnalitica]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

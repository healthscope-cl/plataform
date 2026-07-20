'use client'

import { useMemo, useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { IndicadorPersona } from '@/lib/indicators/porPersona'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Columna = 'diasPerdidos' | 'cantidadEpisodios' | 'costoEstimado'

const COLUMNAS: Array<{ clave: Columna; etiqueta: string }> = [
  { clave: 'diasPerdidos', etiqueta: 'Días perdidos' },
  { clave: 'cantidadEpisodios', etiqueta: 'Episodios' },
  { clave: 'costoEstimado', etiqueta: 'Costo estimado' },
]

function formatCosto(valor: number) {
  return `$${valor.toLocaleString('es-CL')}`
}

function SortIcon({ direccion }: { direccion: 'ascending' | 'descending' | 'none' }) {
  if (direccion === 'none') return null
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <path fill="currentColor" d={direccion === 'ascending' ? 'M6 3 L10 9 L2 9 Z' : 'M6 9 L2 3 L10 3 Z'} />
    </svg>
  )
}

export function PersonaDetalleTable({
  rolClave,
  personas,
}: {
  rolClave: string
  personas: IndicadorPersona[]
}) {
  const [columnaOrden, setColumnaOrden] = useState<Columna>('costoEstimado')
  const [ascendente, setAscendente] = useState(false)

  const personasOrdenadas = useMemo(() => {
    const copia = [...personas]
    copia.sort((a, b) => (ascendente ? a[columnaOrden] - b[columnaOrden] : b[columnaOrden] - a[columnaOrden]))
    return copia
  }, [personas, columnaOrden, ascendente])

  // The DB-level rate limit is Guardar línea base's (superadmin/admin_cliente insert
  // policy); this table has no DB write, but showing individual cost/days per person is a
  // deliberate access decision (confirmed with the product owner), not a technical one —
  // keep this gate even though nothing here calls Supabase.
  if (!isAdminRole(rolClave)) return null

  function alternarOrden(columna: Columna) {
    if (columna === columnaOrden) {
      setAscendente((anterior) => !anterior)
    } else {
      setColumnaOrden(columna)
      setAscendente(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg font-semibold text-foreground">Detalle por persona</h2>
      <div className="mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              {COLUMNAS.map((columna) => {
                const direccion = columna.clave === columnaOrden ? (ascendente ? 'ascending' : 'descending') : 'none'
                return (
                  <TableHead key={columna.clave} className="text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() => alternarOrden(columna.clave)}
                      aria-sort={direccion}
                    >
                      {columna.etiqueta}
                      <SortIcon direccion={direccion} />
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {personasOrdenadas.map((persona, indice) => (
              <TableRow key={persona.id} className={indice % 2 === 1 ? 'bg-muted/30' : undefined}>
                <TableCell className="text-foreground">{persona.codigo}</TableCell>
                <TableCell className="text-right text-foreground tabular-nums">{persona.diasPerdidos}</TableCell>
                <TableCell className="text-right text-foreground tabular-nums">{persona.cantidadEpisodios}</TableCell>
                <TableCell className="text-right text-foreground tabular-nums">{formatCosto(persona.costoEstimado)}</TableCell>
              </TableRow>
            ))}
            {personasOrdenadas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-4 text-center text-muted-foreground">
                  No hay personas para mostrar.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

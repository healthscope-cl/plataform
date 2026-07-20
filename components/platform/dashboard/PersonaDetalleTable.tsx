'use client'

import { useMemo, useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { IndicadorPersona } from '@/lib/indicators/porPersona'

type Columna = 'diasPerdidos' | 'cantidadEpisodios' | 'costoEstimado'

const COLUMNAS: Array<{ clave: Columna; etiqueta: string }> = [
  { clave: 'diasPerdidos', etiqueta: 'Días perdidos' },
  { clave: 'cantidadEpisodios', etiqueta: 'Episodios' },
  { clave: 'costoEstimado', etiqueta: 'Costo estimado' },
]

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
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Código</th>
              {COLUMNAS.map((columna) => (
                <th key={columna.clave} className="py-2 pr-4">
                  <button
                    type="button"
                    className="rounded font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => alternarOrden(columna.clave)}
                    aria-sort={columna.clave === columnaOrden ? (ascendente ? 'ascending' : 'descending') : 'none'}
                  >
                    {columna.etiqueta}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personasOrdenadas.map((persona) => (
              <tr key={persona.id} className="border-b border-border/50">
                <td className="py-2 pr-4 text-foreground">{persona.codigo}</td>
                <td className="py-2 pr-4 text-foreground">{persona.diasPerdidos}</td>
                <td className="py-2 pr-4 text-foreground">{persona.cantidadEpisodios}</td>
                <td className="py-2 pr-4 text-foreground">${persona.costoEstimado.toLocaleString('es-CL')}</td>
              </tr>
            ))}
            {personasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  No hay personas para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

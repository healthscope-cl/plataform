'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import type { Encuesta, EstadoEncuesta } from '@/lib/encuestas/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EncuestaSheet } from './EncuestaSheet'

const SIGUIENTE_ESTADO: Record<EstadoEncuesta, EstadoEncuesta | null> = {
  borrador: 'activa',
  activa: 'cerrada',
  cerrada: null,
}

const ACCION_LABEL: Record<EstadoEncuesta, string> = {
  borrador: 'Activar',
  activa: 'Cerrar',
  cerrada: '',
}

const ESTADO_LABEL: Record<EstadoEncuesta, string> = {
  borrador: 'Borrador',
  activa: 'Activa',
  cerrada: 'Cerrada',
}

export function EncuestasTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialEncuestas,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialEncuestas: Encuesta[]
}) {
  const [encuestas, setEncuestas] = useState(initialEncuestas)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(encuesta: Encuesta) {
    setEncuestas((prev) => [encuesta, ...prev])
  }

  async function handleAvanzarEstado(encuesta: Encuesta) {
    const siguiente = SIGUIENTE_ESTADO[encuesta.estado]
    if (!siguiente) return

    const supabase = createClient()
    const { error } = await supabase.from('encuestas').update({ estado: siguiente }).eq('id', encuesta.id)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'encuestas',
      entidadId: encuesta.id,
      accion: 'actualizar',
      datosAntes: { estado: encuesta.estado },
      datosDespues: { estado: siguiente },
    })

    setEncuestas((prev) => prev.map((e) => (e.id === encuesta.id ? { ...e, estado: siguiente } : e)))
  }

  function copiarLink(id: string) {
    const url = `${window.location.origin}/encuestas/${id}`
    navigator.clipboard.writeText(url)
    setLinkCopiado(id)
    setTimeout(() => setLinkCopiado((actual) => (actual === id ? null : actual)), 2000)
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <EncuestaSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {encuestas.map((encuesta) => (
            <TableRow key={encuesta.id}>
              <TableCell>{encuesta.titulo}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[encuesta.estado]}</Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Link href={`/plataforma/encuestas/${encuesta.id}`}>
                  <Button type="button" variant="outline" size="sm">
                    Ver resultados
                  </Button>
                </Link>
                {encuesta.estado === 'activa' ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => copiarLink(encuesta.id)}>
                    {linkCopiado === encuesta.id ? 'Copiado' : 'Copiar link'}
                  </Button>
                ) : null}
                {canEdit && SIGUIENTE_ESTADO[encuesta.estado] ? (
                  <Button type="button" size="sm" onClick={() => handleAvanzarEstado(encuesta)}>
                    {ACCION_LABEL[encuesta.estado]}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {encuestas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                No hay encuestas creadas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

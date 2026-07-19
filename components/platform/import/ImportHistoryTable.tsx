'use client'

import { useState } from 'react'
import type { Importacion } from '@/lib/ingestion/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const ESTADO_LABELS: Record<Importacion['estado'], string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  revertida: 'Revertida',
  fallida: 'Fallida',
}

export function ImportHistoryTable({ initialImportaciones }: { initialImportaciones: Importacion[] }) {
  const [importaciones, setImportaciones] = useState(initialImportaciones)
  const [revirtiendoId, setRevirtiendoId] = useState<string | null>(null)

  async function handleRevertir(importacionId: string) {
    setRevirtiendoId(importacionId)
    const response = await fetch('/api/platform/importaciones/revertir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importacionId }),
    })
    if (response.ok) {
      setImportaciones((prev) =>
        prev.map((imp) => (imp.id === importacionId ? { ...imp, estado: 'revertida' } : imp))
      )
    }
    setRevirtiendoId(null)
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Archivo</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Procesadas</TableHead>
          <TableHead>Rechazadas</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {importaciones.map((importacion) => (
          <TableRow key={importacion.id}>
            <TableCell>{importacion.archivoNombre}</TableCell>
            <TableCell>{new Date(importacion.createdAt).toLocaleDateString('es-CL')}</TableCell>
            <TableCell>
              <Badge variant={importacion.estado === 'completada' ? 'secondary' : 'outline'}>
                {ESTADO_LABELS[importacion.estado]}
              </Badge>
            </TableCell>
            <TableCell>{importacion.filasProcesadas}</TableCell>
            <TableCell>{importacion.filasRechazadas}</TableCell>
            <TableCell className="text-right">
              {importacion.estado === 'completada' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revirtiendoId === importacion.id}
                  onClick={() => handleRevertir(importacion.id)}
                >
                  {revirtiendoId === importacion.id ? 'Revirtiendo…' : 'Revertir'}
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

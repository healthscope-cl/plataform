'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { Rol, Usuario } from '@/lib/platform/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InvitarUsuarioSheet } from './InvitarUsuarioSheet'

export function UsuariosTable({
  tenantId,
  actorId,
  initialUsuarios,
  roles,
}: {
  tenantId: string
  actorId: string
  initialUsuarios: Usuario[]
  roles: Rol[]
}) {
  const [usuarios, setUsuarios] = useState(initialUsuarios)
  const roleName = (rolId: string) => roles.find((r) => r.id === rolId)?.nombre ?? rolId

  async function handleToggleEstado(usuario: Usuario) {
    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo'
    const supabase = createClient()
    const { data, error } = await supabase
      .from('usuarios')
      .update({ estado: nuevoEstado })
      .eq('id', usuario.id)
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'actualizar',
      datosAntes: { estado: usuario.estado },
      datosDespues: { estado: nuevoEstado },
    })

    setUsuarios((prev) =>
      prev.map((u) => (u.id === usuario.id ? { ...u, estado: nuevoEstado } : u))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InvitarUsuarioSheet onInvited={(usuario) => setUsuarios((prev) => [...prev, usuario])} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell>{usuario.nombre}</TableCell>
              <TableCell>{usuario.email}</TableCell>
              <TableCell>{roleName(usuario.rolId)}</TableCell>
              <TableCell>
                <Badge variant={usuario.estado === 'activo' ? 'default' : 'secondary'}>
                  {usuario.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => handleToggleEstado(usuario)}>
                  {usuario.estado === 'activo' ? 'Desactivar' : 'Reactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

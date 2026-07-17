'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ROLE_KEYS, type RoleKey } from '@/lib/platform/roles'
import type { Usuario } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  email: z.string().email('Correo inválido'),
  rolClave: z.enum(ROLE_KEYS as unknown as [RoleKey, ...RoleKey[]]),
})

export function InvitarUsuarioSheet({ onInvited }: { onInvited: (usuario: Usuario) => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', email: '', rolClave: 'solo_lectura' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    setServerError(null)
    const response = await fetch('/api/platform/usuarios/invitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (!response.ok) {
      const { error } = await response.json()
      setServerError(error)
      return
    }

    const usuario: Usuario = await response.json()
    onInvited(usuario)
    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Invitar usuario</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invitar usuario</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rolClave">Rol</Label>
            <Select
              defaultValue="solo_lectura"
              onValueChange={(value) => form.setValue('rolClave', value as RoleKey)}
            >
              <SelectTrigger id="rolClave" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_KEYS.map((clave) => (
                  <SelectItem key={clave} value={clave}>
                    {clave}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
          <Button type="submit">Invitar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

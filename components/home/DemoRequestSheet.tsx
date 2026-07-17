'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

const demoSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  empresa: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
  cargo: z.string().optional(),
})

type DemoFormValues = z.infer<typeof demoSchema>

interface DemoRequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DemoRequestSheet({ open, onOpenChange }: DemoRequestSheetProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const form = useForm<DemoFormValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: { nombre: '', empresa: '', email: '', telefono: '', cargo: '' },
  })

  async function onSubmit(values: DemoFormValues) {
    setStatus('idle')
    const supabase = createClient()
    const { error } = await supabase.from('demo_requests').insert({
      nombre: values.nombre,
      empresa: values.empresa,
      email: values.email,
      telefono: values.telefono || null,
      cargo: values.cargo || null,
    })

    if (error) {
      setStatus('error')
      return
    }

    setStatus('success')
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Solicitar demostración</SheetTitle>
          <SheetDescription>Cuéntanos quién eres y te contactaremos para coordinar una demostración.</SheetDescription>
        </SheetHeader>

        {status === 'success' ? (
          <p className="px-4 py-6 text-sm text-[#38D978]">Gracias, te contactaremos pronto.</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-6">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {status === 'error' && <p className="text-sm text-red-500">No pudimos enviar tu solicitud. Intenta de nuevo.</p>}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full rounded-full bg-[#1455E6] hover:bg-[#1455E6]/90"
              >
                {form.formState.isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  )
}

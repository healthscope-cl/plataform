'use client'

import type { Empresa } from '@/lib/platform/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function EmpresaSwitcher({ empresas }: { empresas: Empresa[] }) {
  if (empresas.length <= 1) {
    return (
      <span className="text-sm font-medium text-foreground">
        {empresas[0]?.nombre ?? 'Sin empresa'}
      </span>
    )
  }

  return (
    <Select defaultValue={empresas[0].id}>
      <SelectTrigger className="w-48">
        <SelectValue>{(id: string) => empresas.find((empresa) => empresa.id === id)?.nombre ?? id}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {empresas.map((empresa) => (
          <SelectItem key={empresa.id} value={empresa.id}>
            {empresa.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

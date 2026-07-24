'use client'

import { useRouter } from 'next/navigation'
import type { Empresa } from '@/lib/platform/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function EmpresaSwitcher({
  empresas,
  empresaActivaId,
}: {
  empresas: Empresa[]
  empresaActivaId: string
}) {
  const router = useRouter()

  if (empresas.length <= 1) {
    return (
      <span className="text-sm font-medium text-foreground">
        {empresas[0]?.nombre ?? 'Sin empresa'}
      </span>
    )
  }

  async function handleChange(empresaId: string | null) {
    if (empresaId === null) return
    await fetch('/api/platform/empresa-activa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId }),
    })
    router.refresh()
  }

  return (
    <Select value={empresaActivaId} onValueChange={handleChange}>
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'

export function GuardarLineaBaseButton({
  tenantId,
  empresaId,
  actorId,
  periodoInicio,
  periodoFin,
  indicadores,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  periodoInicio: string
  periodoFin: string
  indicadores: IndicadorResultados
}) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    const supabase = createClient()
    await supabase.from('lineas_base').insert({
      tenant_id: tenantId,
      empresa_id: empresaId,
      creada_por: actorId,
      periodo_inicio: periodoInicio,
      periodo_fin: periodoFin,
      indicadores,
    })
    setGuardando(false)
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" disabled={guardando} onClick={handleGuardar}>
      {guardando ? 'Guardando…' : 'Guardar línea base'}
    </Button>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import { Button } from '@/components/ui/button'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'

export function GuardarLineaBaseButton({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  periodoInicio,
  periodoFin,
  indicadores,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  periodoInicio: string
  periodoFin: string
  indicadores: IndicadorResultados
}) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The DB policy `lineas_base_insert_admin` only allows superadmin/admin_cliente to
  // insert; keep the button hidden for other roles rather than showing a control that
  // will always fail.
  if (!isAdminRole(rolClave)) return null

  async function handleGuardar() {
    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('lineas_base')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        creada_por: actorId,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        indicadores,
      })
      .select()
      .single()

    if (insertError || !data) {
      setError('No se pudo guardar la línea base. Intenta nuevamente.')
      setGuardando(false)
      return
    }

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'lineas_base',
      entidadId: data.id,
      accion: 'crear',
      datosAntes: null,
      datosDespues: { periodoInicio, periodoFin, indicadores },
    })

    setGuardando(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={guardando} onClick={handleGuardar}>
        {guardando ? 'Guardando…' : 'Guardar línea base'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

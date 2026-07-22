'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIPOS_PUBLICOS = [
  { value: 'condicion_insegura', label: 'Condición insegura' },
  { value: 'cuasi_accidente', label: 'Cuasi accidente' },
] as const

type TipoPublico = (typeof TIPOS_PUBLICOS)[number]['value']

export function ReportarForm({
  tenantId,
  empresaId,
  sucursales,
}: {
  tenantId: string
  empresaId: string
  sucursales: Array<{ id: string; nombre: string }>
}) {
  const [tipo, setTipo] = useState<TipoPublico>('condicion_insegura')
  const [descripcion, setDescripcion] = useState('')
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit() {
    if (!descripcion.trim()) return
    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.from('eventos_seguridad').insert({
      tenant_id: tenantId,
      empresa_id: empresaId,
      tipo,
      descripcion,
      gravedad: 'leve',
      fecha: new Date().toISOString().slice(0, 10),
      sucursal_id: sucursalId,
    })
    setEnviando(false)
    if (error) return
    setEnviado(true)
  }

  if (enviado) {
    return <p className="text-sm text-foreground">Gracias por tu reporte.</p>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reportar-tipo">Tipo</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPublico)}>
          <SelectTrigger id="reportar-tipo" className="w-full">
            <SelectValue>
              {(valor: TipoPublico) => TIPOS_PUBLICOS.find((t) => t.value === valor)?.label ?? valor}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIPOS_PUBLICOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reportar-descripcion">¿Qué observaste?</Label>
        <textarea
          id="reportar-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {sucursales.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="reportar-sucursal">Sucursal (opcional)</Label>
          <Select
            value={sucursalId ?? '__ninguna__'}
            onValueChange={(v) => setSucursalId(v === '__ninguna__' ? null : v)}
          >
            <SelectTrigger id="reportar-sucursal" className="w-full">
              <SelectValue>
                {(valor: string) =>
                  valor === '__ninguna__' ? 'Prefiero no decir' : (sucursales.find((s) => s.id === valor)?.nombre ?? valor)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ninguna__">Prefiero no decir</SelectItem>
              {sucursales.map((sucursal) => (
                <SelectItem key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <Button type="button" disabled={!descripcion.trim() || enviando} onClick={handleSubmit}>
        {enviando ? 'Enviando…' : 'Enviar reporte'}
      </Button>
    </div>
  )
}

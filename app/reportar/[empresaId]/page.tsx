import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReportarForm } from '@/components/seguridad/ReportarForm'

export default async function ReportarPage({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params
  const admin = createAdminClient()

  const { data: empresaRow } = await admin
    .from('empresas')
    .select('id, tenant_id')
    .eq('id', empresaId)
    .maybeSingle()

  if (!empresaRow) notFound()

  const { data: sucursalRows } = await admin.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground">Reportar una condición de seguridad</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este reporte es anónimo — no se registra quién lo envía.
        </p>
      </div>
      <ReportarForm tenantId={empresaRow.tenant_id as string} empresaId={empresaRow.id as string} sucursales={sucursales} />
    </div>
  )
}

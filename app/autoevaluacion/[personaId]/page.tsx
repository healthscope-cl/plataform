import { createAdminClient } from '@/lib/supabase/admin'
import { AutoevaluacionForm } from '@/components/ergonomia/AutoevaluacionForm'

// Public, unauthenticated page (the worker never logs in) — uses the admin client server-side
// only to render a minimal, safe confirmation ("Autoevaluación para EMP003"); nothing sensitive
// is ever sent to the browser. The actual submission goes through /api/autoevaluaciones/enviar,
// which is also service-role only (see that route's comment).
export default async function AutoevaluacionPublicaPage({ params }: { params: Promise<{ personaId: string }> }) {
  const { personaId } = await params
  const admin = createAdminClient()

  const { data: persona } = await admin
    .from('personas')
    .select('id, codigo, estado')
    .eq('id', personaId)
    .maybeSingle()

  if (!persona || persona.estado !== 'activo') {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">Este link ya no está disponible</h1>
        <p className="text-sm text-muted-foreground">
          Puede que el link haya expirado o que ya no corresponda a una persona activa.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground">Autoevaluación ergonómica</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Responde estas preguntas sobre tu puesto de trabajo ({persona.codigo}). Es rápido y te mostraremos
          recomendaciones al instante.
        </p>
      </div>
      <AutoevaluacionForm personaId={persona.id} />
    </div>
  )
}

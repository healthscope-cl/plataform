import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluarAutoevaluacion, type RespuestasAutoevaluacion } from '@/lib/ergonomia/autoevaluacion'

// Public, unauthenticated endpoint (the worker never logs in) — everything is written with the
// service role client instead of relying on anon RLS grants, so `personas` never needs to grant
// anon select just to satisfy an insert-time check (see the schema comment on
// autoevaluaciones_ergonomicas). The admin client is only used server-side, never exposed to
// the browser.
export async function POST(request: Request) {
  const body = await request.json()
  const { personaId, respuestas, necesitaAyuda } = body as {
    personaId: string
    respuestas: RespuestasAutoevaluacion
    necesitaAyuda: boolean
  }

  if (!personaId || !respuestas) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: persona } = await admin
    .from('personas')
    .select('id, tenant_id, empresa_id, estado')
    .eq('id', personaId)
    .maybeSingle()

  if (!persona || persona.estado !== 'activo') {
    return NextResponse.json({ error: 'Esta persona no está disponible.' }, { status: 404 })
  }

  const resultado = evaluarAutoevaluacion(respuestas)

  const { error } = await admin.from('autoevaluaciones_ergonomicas').insert({
    tenant_id: persona.tenant_id,
    empresa_id: persona.empresa_id,
    persona_id: persona.id,
    respuestas,
    nivel_riesgo: resultado.nivelRiesgo,
    recomendacion: resultado.recomendacion,
    necesita_ayuda: necesitaAyuda ?? false,
  })

  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar la autoevaluación.' }, { status: 500 })
  }

  return NextResponse.json(resultado, { status: 201 })
}

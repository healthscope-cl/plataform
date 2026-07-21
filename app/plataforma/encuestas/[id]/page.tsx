import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEncuestaRow, mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { agregarRespuestas } from '@/lib/encuestas/agregar'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'

export default async function ResultadosEncuestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: encuestaRow } = await supabase.from('encuestas').select('*').eq('id', id).maybeSingle()
  if (!encuestaRow) notFound()
  const encuesta = mapEncuestaRow(encuestaRow)

  // Raw individual responses have no authenticated-role SELECT policy by design (see Task 1) —
  // this Server Component is the one place allowed to see them, precisely so it can aggregate
  // (and apply small-group suppression) before anything reaches the browser.
  const admin = createAdminClient()
  const { data: respuestaRows } = await admin.from('encuesta_respuestas').select('*').eq('encuesta_id', id)
  const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

  const resultados = agregarRespuestas({
    preguntaIds: encuesta.preguntaIds,
    respuestas: respuestas.map((r) => r.respuestas),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{encuesta.titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{respuestas.length} respuestas recibidas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {encuesta.preguntaIds.map((preguntaId) => {
          const pregunta = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)
          const resultado = resultados[preguntaId]
          return (
            <div key={preguntaId} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{pregunta?.texto ?? preguntaId}</p>
              {resultado && 'suprimido' in resultado ? (
                <p className="mt-2 text-sm text-muted-foreground">Grupo insuficiente para mostrar</p>
              ) : resultado ? (
                <>
                  <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
                    {resultado.promedio.toFixed(1)} / 5
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Basado en {resultado.cantidad} respuestas</p>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

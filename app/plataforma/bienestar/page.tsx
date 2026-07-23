import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { agregarRespuestas } from '@/lib/encuestas/agregar'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'

const BIENESTAR_PREGUNTA_IDS = ['estres', 'fatiga', 'sueno', 'carga', 'liderazgo', 'conciliacion', 'clima']

export default async function BienestarPreventivoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)

  const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', empresa.id)
  const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

  // encuesta_respuestas has no authenticated-role SELECT policy by design (see the encuestas
  // module's Task 1 security fix) — this Server Component is one of the few places allowed to
  // read raw rows, precisely so it can aggregate (and apply small-group suppression) before
  // anything reaches the browser.
  const admin = createAdminClient()
  const { data: respuestaRows } =
    encuestaIds.length > 0
      ? await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
      : { data: [] }
  const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

  const resultados = agregarRespuestas({
    preguntaIds: BIENESTAR_PREGUNTA_IDS,
    respuestas: respuestas.map((r) => r.respuestas),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Bienestar preventivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Promedio agregado de todas las encuestas de {empresa.nombre}, sin filtrar por período.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BIENESTAR_PREGUNTA_IDS.map((preguntaId) => {
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

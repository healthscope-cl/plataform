import { createClient } from '@/lib/supabase/server'
import { mapEncuestaRow } from '@/lib/encuestas/types'
import { EncuestaResponderForm } from '@/components/encuestas/EncuestaResponderForm'

export default async function EncuestaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: encuestaRow } = await supabase
    .from('encuestas')
    .select('*')
    .eq('id', id)
    .eq('estado', 'activa')
    .maybeSingle()

  if (!encuestaRow) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">Esta encuesta ya no está disponible</h1>
        <p className="text-sm text-muted-foreground">Puede que haya cerrado o que el link ya no sea válido.</p>
      </div>
    )
  }

  const encuesta = mapEncuestaRow(encuestaRow)

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground">{encuesta.titulo}</h1>
        {encuesta.descripcion ? <p className="mt-2 text-sm text-muted-foreground">{encuesta.descripcion}</p> : null}
      </div>
      <EncuestaResponderForm encuestaId={encuesta.id} preguntaIds={encuesta.preguntaIds} />
    </div>
  )
}

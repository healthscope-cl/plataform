'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { Button } from '@/components/ui/button'

const ESCALA = [1, 2, 3, 4, 5]

export function EncuestaResponderForm({
  encuestaId,
  preguntaIds,
}: {
  encuestaId: string
  preguntaIds: string[]
}) {
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const preguntas = preguntaIds
    .map((id) => CATALOGO_PREGUNTAS.find((p) => p.id === id))
    .filter((p): p is (typeof CATALOGO_PREGUNTAS)[number] => Boolean(p))

  const completo = preguntas.every((p) => respuestas[p.id] !== undefined)

  async function handleSubmit() {
    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.from('encuesta_respuestas').insert({ encuesta_id: encuestaId, respuestas })
    setEnviando(false)
    if (error) return
    setEnviado(true)
  }

  if (enviado) {
    return <p className="text-sm text-foreground">Gracias por tu respuesta.</p>
  }

  return (
    <div className="space-y-6">
      {preguntas.map((pregunta) => (
        <div key={pregunta.id} className="space-y-2">
          <p className="text-sm text-foreground">{pregunta.texto}</p>
          <div className="flex gap-2">
            {ESCALA.map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setRespuestas((prev) => ({ ...prev, [pregunta.id]: valor }))}
                className={
                  'h-10 w-10 rounded-full border text-sm font-medium ' +
                  (respuestas[pregunta.id] === valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-muted')
                }
                aria-pressed={respuestas[pregunta.id] === valor}
              >
                {valor}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button type="button" disabled={!completo || enviando} onClick={handleSubmit}>
        {enviando ? 'Enviando…' : 'Enviar respuesta'}
      </Button>
    </div>
  )
}

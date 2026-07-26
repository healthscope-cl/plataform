'use client'

import { useState } from 'react'
import { evaluarAutoevaluacion, type RespuestasAutoevaluacion } from '@/lib/ergonomia/autoevaluacion'
import { Button } from '@/components/ui/button'
import { GaugeChart } from '@/components/platform/GaugeChart'

const PREGUNTAS_SI_NO: Array<{ clave: keyof Omit<RespuestasAutoevaluacion, 'molestias'>; texto: string }> = [
  { clave: 'pantallaAlturaOjos', texto: '¿El borde superior de tu pantalla queda a la altura de tus ojos?' },
  { clave: 'sillaConSoporteLumbar', texto: '¿Tu silla apoya la zona lumbar (parte baja de la espalda)?' },
  { clave: 'pausasActivas', texto: '¿Tomas una pausa activa cada 1 a 2 horas de trabajo continuo?' },
  { clave: 'piesApoyados', texto: '¿Tus pies apoyan completos en el suelo cuando estás sentado?' },
]

const OPCIONES_MOLESTIAS: Array<{ valor: RespuestasAutoevaluacion['molestias']; label: string }> = [
  { valor: 'nunca', label: 'Nunca' },
  { valor: 'a_veces', label: 'A veces' },
  { valor: 'frecuentemente', label: 'Frecuentemente' },
]

const NIVEL_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }
const NIVEL_VALOR: Record<string, number> = { bajo: 20, medio: 50, alto: 85 }

export function AutoevaluacionForm({ personaId }: { personaId: string }) {
  const [respuestas, setRespuestas] = useState<Partial<RespuestasAutoevaluacion>>({})
  const [resultado, setResultado] = useState<ReturnType<typeof evaluarAutoevaluacion> | null>(null)
  const [necesitaAyuda, setNecesitaAyuda] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completo =
    respuestas.pantallaAlturaOjos !== undefined &&
    respuestas.sillaConSoporteLumbar !== undefined &&
    respuestas.pausasActivas !== undefined &&
    respuestas.piesApoyados !== undefined &&
    respuestas.molestias !== undefined

  function verRecomendacion() {
    if (!completo) return
    setResultado(evaluarAutoevaluacion(respuestas as RespuestasAutoevaluacion))
  }

  async function enviar() {
    setEnviando(true)
    setError(null)
    const response = await fetch('/api/autoevaluaciones/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId, respuestas, necesitaAyuda }),
    })
    setEnviando(false)
    if (!response.ok) {
      setError('No pudimos guardar tu autoevaluación. Intenta de nuevo.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">Gracias por completar tu autoevaluación.</p>
        {necesitaAyuda ? (
          <p className="text-sm text-muted-foreground">
            Le avisamos a prevención que todavía necesitas ayuda con tu puesto de trabajo.
          </p>
        ) : null}
      </div>
    )
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-center text-sm text-muted-foreground">Nivel de riesgo detectado</p>
          <div className="mt-2">
            <GaugeChart valor={NIVEL_VALOR[resultado.nivelRiesgo]} etiqueta={NIVEL_LABEL[resultado.nivelRiesgo]} />
          </div>
          <p className="mt-3 text-sm text-foreground">{resultado.recomendacion}</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={necesitaAyuda}
            onChange={(e) => setNecesitaAyuda(e.target.checked)}
            className="mt-0.5"
          />
          Todavía tengo molestias o necesito ayuda adicional con mi puesto de trabajo.
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" disabled={enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {PREGUNTAS_SI_NO.map((pregunta) => (
        <div key={pregunta.clave} className="space-y-2">
          <p className="text-sm text-foreground">{pregunta.texto}</p>
          <div className="flex gap-2">
            {[
              { valor: true, label: 'Sí' },
              { valor: false, label: 'No' },
            ].map((opcion) => (
              <button
                key={String(opcion.valor)}
                type="button"
                onClick={() => setRespuestas((prev) => ({ ...prev, [pregunta.clave]: opcion.valor }))}
                className={
                  'h-10 min-w-16 rounded-full border px-4 text-sm font-medium ' +
                  (respuestas[pregunta.clave] === opcion.valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-muted')
                }
                aria-pressed={respuestas[pregunta.clave] === opcion.valor}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <p className="text-sm text-foreground">¿Con qué frecuencia sientes molestias en cuello, espalda o muñecas?</p>
        <div className="flex gap-2">
          {OPCIONES_MOLESTIAS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => setRespuestas((prev) => ({ ...prev, molestias: opcion.valor }))}
              className={
                'h-10 rounded-full border px-4 text-sm font-medium ' +
                (respuestas.molestias === opcion.valor
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-foreground hover:bg-muted')
              }
              aria-pressed={respuestas.molestias === opcion.valor}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      </div>
      <Button type="button" disabled={!completo} onClick={verRecomendacion}>
        Ver mi recomendación
      </Button>
    </div>
  )
}

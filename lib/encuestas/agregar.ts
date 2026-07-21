import { MIN_GROUP_SIZE } from '../indicators/formulas'

export type ResultadoPregunta = { promedio: number; cantidad: number } | { suprimido: true }

export function agregarRespuestas(input: {
  preguntaIds: string[]
  respuestas: Array<Record<string, number>>
}): Record<string, ResultadoPregunta> {
  const resultado: Record<string, ResultadoPregunta> = {}

  for (const preguntaId of input.preguntaIds) {
    const valores = input.respuestas
      .map((r) => r[preguntaId])
      .filter((v): v is number => typeof v === 'number')

    if (valores.length < MIN_GROUP_SIZE) {
      resultado[preguntaId] = { suprimido: true }
      continue
    }

    const suma = valores.reduce((acc, v) => acc + v, 0)
    resultado[preguntaId] = { promedio: suma / valores.length, cantidad: valores.length }
  }

  return resultado
}

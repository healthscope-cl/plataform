import { MIN_GROUP_SIZE } from '../indicators/formulas'

export type ResultadoMedicion = { promedio: number; cantidad: number } | { suprimido: true } | { sinDatos: true }

export function medirAntesDespues(input: {
  valores: Array<{ valor: number; fecha: string }>
  fechaInicio: string
  fechaFin: string | null
}): { antes: ResultadoMedicion; despues: ResultadoMedicion | null } {
  const antesValores = input.valores.filter((v) => v.fecha < input.fechaInicio).map((v) => v.valor)
  const antes = calcular(antesValores)

  if (!input.fechaFin) {
    return { antes, despues: null }
  }

  const fechaFin = input.fechaFin
  const despuesValores = input.valores.filter((v) => v.fecha > fechaFin).map((v) => v.valor)
  const despues = calcular(despuesValores)

  return { antes, despues }
}

function calcular(valores: number[]): ResultadoMedicion {
  if (valores.length === 0) return { sinDatos: true }
  if (valores.length < MIN_GROUP_SIZE) return { suprimido: true }
  const suma = valores.reduce((acc, v) => acc + v, 0)
  return { promedio: suma / valores.length, cantidad: valores.length }
}

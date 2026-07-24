export function huboIncrementoIncidentes(input: {
  fechas: string[]
  fechaCorte: string
}): { actual: number; anterior: number; incremento: boolean } {
  const corte = new Date(input.fechaCorte)

  const inicioActual = new Date(corte)
  inicioActual.setMonth(inicioActual.getMonth() - 3)
  const inicioActualStr = inicioActual.toISOString().slice(0, 10)

  const inicioAnterior = new Date(inicioActual)
  inicioAnterior.setMonth(inicioAnterior.getMonth() - 3)
  const inicioAnteriorStr = inicioAnterior.toISOString().slice(0, 10)

  let actual = 0
  let anterior = 0

  for (const fecha of input.fechas) {
    if (fecha >= inicioActualStr && fecha <= input.fechaCorte) {
      actual += 1
    } else if (fecha >= inicioAnteriorStr && fecha < inicioActualStr) {
      anterior += 1
    }
  }

  return { actual, anterior, incremento: actual > anterior }
}

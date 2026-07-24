const MS_POR_DIA = 24 * 60 * 60 * 1000
const DIAS_POR_VENTANA = 90

function aFechaUTC(fecha: string): number {
  const [ano, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(ano, mes - 1, dia)
}

export function huboIncrementoIncidentes(input: {
  fechas: string[]
  fechaCorte: string
}): { actual: number; anterior: number; incremento: boolean } {
  const corteMs = aFechaUTC(input.fechaCorte)
  const inicioActualMs = corteMs - DIAS_POR_VENTANA * MS_POR_DIA
  const inicioAnteriorMs = inicioActualMs - DIAS_POR_VENTANA * MS_POR_DIA

  let actual = 0
  let anterior = 0

  for (const fecha of input.fechas) {
    const fechaMs = aFechaUTC(fecha)
    if (fechaMs >= inicioActualMs && fechaMs <= corteMs) {
      actual += 1
    } else if (fechaMs >= inicioAnteriorMs && fechaMs < inicioActualMs) {
      anterior += 1
    }
  }

  return { actual, anterior, incremento: actual > anterior }
}

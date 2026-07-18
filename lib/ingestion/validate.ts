export type MappedRow = {
  rut: string | null
  fechaInicio: string | null
  fechaFin?: string | null
  dias: number | null
  tipoAdministrativo: string | null
}

export type RowError = {
  tipo: string
  severidad: 'critico' | 'advertencia'
  mensaje: string
}

export type ValidationResult = {
  filaErrors: Map<number, RowError[]>
  resumen: { criticos: number; advertencias: number }
}

function addError(filaErrors: Map<number, RowError[]>, fila: number, error: RowError) {
  const existing = filaErrors.get(fila) ?? []
  existing.push(error)
  filaErrors.set(fila, existing)
}

export function validateRows(input: { rows: MappedRow[]; tiposValidos: string[] }): ValidationResult {
  const filaErrors = new Map<number, RowError[]>()
  const seenKeys = new Map<string, number>()
  const periodsByRut = new Map<string, Array<{ fila: number; inicio: string; fin: string }>>()

  input.rows.forEach((row, fila) => {
    if (!row.rut || !row.fechaInicio || !row.tipoAdministrativo) {
      addError(filaErrors, fila, {
        tipo: 'campo_obligatorio_faltante',
        severidad: 'critico',
        mensaje: 'Falta RUT, fecha de inicio o tipo administrativo.',
      })
      return
    }

    if (row.dias === null || !Number.isFinite(row.dias) || row.dias <= 0) {
      addError(filaErrors, fila, {
        tipo: 'duracion_invalida',
        severidad: 'critico',
        mensaje: 'Los días de ausencia deben ser un número positivo.',
      })
    }

    if (!input.tiposValidos.includes(row.tipoAdministrativo)) {
      addError(filaErrors, fila, {
        tipo: 'tipo_no_reconocido',
        severidad: 'critico',
        mensaje: `El tipo administrativo "${row.tipoAdministrativo}" no está en el catálogo.`,
      })
    }

    const fin = row.fechaFin ?? row.fechaInicio
    if (row.fechaFin && new Date(row.fechaFin) < new Date(row.fechaInicio)) {
      addError(filaErrors, fila, {
        tipo: 'fecha_imposible',
        severidad: 'critico',
        mensaje: 'La fecha de fin es anterior a la fecha de inicio.',
      })
    }

    const dedupeKey = `${row.rut}|${row.fechaInicio}`
    const firstSeenAt = seenKeys.get(dedupeKey)
    if (firstSeenAt !== undefined) {
      addError(filaErrors, fila, {
        tipo: 'fila_duplicada',
        severidad: 'advertencia',
        mensaje: `Fila duplicada de la fila ${firstSeenAt + 1}.`,
      })
    } else {
      seenKeys.set(dedupeKey, fila)
    }

    const periods = periodsByRut.get(row.rut) ?? []
    for (const previous of periods) {
      const overlaps = new Date(row.fechaInicio) <= new Date(previous.fin) && new Date(fin) >= new Date(previous.inicio)
      if (overlaps) {
        addError(filaErrors, fila, {
          tipo: 'periodo_superpuesto',
          severidad: 'critico',
          mensaje: `Se superpone con el período de la fila ${previous.fila + 1}.`,
        })
      }
    }
    periods.push({ fila, inicio: row.fechaInicio, fin })
    periodsByRut.set(row.rut, periods)
  })

  let criticos = 0
  let advertencias = 0
  for (const errors of filaErrors.values()) {
    for (const error of errors) {
      if (error.severidad === 'critico') criticos += 1
      else advertencias += 1
    }
  }

  return { filaErrors, resumen: { criticos, advertencias } }
}

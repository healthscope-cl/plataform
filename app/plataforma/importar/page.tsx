'use client'

import { useMemo, useState } from 'react'
import { parseSpreadsheet, type ParsedSpreadsheet } from '@/lib/ingestion/parseFile'
import { suggestColumnMapping, type CanonicalField } from '@/lib/ingestion/columnMapping'
import { validateRows, type MappedRow } from '@/lib/ingestion/validate'
import { FileDropzone } from '@/components/platform/import/FileDropzone'
import { ColumnMappingStep } from '@/components/platform/import/ColumnMappingStep'
import { QualityErrorsTable } from '@/components/platform/import/QualityErrorsTable'
import { ImportPreviewTable } from '@/components/platform/import/ImportPreviewTable'
import { ImportSummary } from '@/components/platform/import/ImportSummary'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type WizardStep = 'subir' | 'mapear' | 'validar' | 'confirmar' | 'resumen'

const TIPOS_VALIDOS = [
  'enfermedad_comun',
  'prorroga_medicina_preventiva',
  'maternal',
  'enfermedad_grave_hijo_menor',
  'accidente_laboral',
  'accidente_trayecto',
  'enfermedad_profesional',
  'patologia_embarazo',
  'permiso_administrativo',
  'ausencia_injustificada',
  'vacaciones',
  'otros',
]

function toMappedRows(
  parsed: ParsedSpreadsheet,
  mapping: Record<CanonicalField, string | null>
): Array<
  MappedRow & {
    codigoPersona: string | null
    sucursal: string | null
    unidad: string | null
    cargo: string | null
    turno: string | null
  }
> {
  return parsed.rows.map((row) => ({
    rut: mapping.rut ? String(row[mapping.rut] ?? '') || null : null,
    fechaInicio: mapping.fechaInicio ? String(row[mapping.fechaInicio] ?? '') || null : null,
    fechaFin: mapping.fechaFin ? String(row[mapping.fechaFin] ?? '') || null : null,
    dias: mapping.dias ? Number(row[mapping.dias]) : null,
    tipoAdministrativo: mapping.tipoAdministrativo ? String(row[mapping.tipoAdministrativo] ?? '') || null : null,
    codigoPersona: mapping.codigoPersona ? String(row[mapping.codigoPersona] ?? '') || null : null,
    sucursal: mapping.sucursal ? String(row[mapping.sucursal] ?? '') || null : null,
    unidad: mapping.unidad ? String(row[mapping.unidad] ?? '') || null : null,
    cargo: mapping.cargo ? String(row[mapping.cargo] ?? '') || null : null,
    turno: mapping.turno ? String(row[mapping.turno] ?? '') || null : null,
  }))
}

export default function ImportarPage() {
  const [step, setStep] = useState<WizardStep>('subir')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<Record<CanonicalField, string | null> | null>(null)
  const [resumen, setResumen] = useState<{ filasProcesadas: number; filasRechazadas: number } | null>(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [archivoRepetidoAviso, setArchivoRepetidoAviso] = useState<string | null>(null)

  const mappedRows = useMemo(() => (parsed && mapping ? toMappedRows(parsed, mapping) : []), [parsed, mapping])
  const validation = useMemo(() => validateRows({ rows: mappedRows, tiposValidos: TIPOS_VALIDOS }), [mappedRows])
  const excludedRows = useMemo(() => {
    const excluded = new Set<number>()
    for (const [fila, errors] of validation.filaErrors) {
      if (errors.some((error) => error.severidad === 'critico')) excluded.add(fila)
    }
    return excluded
  }, [validation])

  async function handleFileSelected(selected: File) {
    const buffer = await selected.arrayBuffer()
    const result = parseSpreadsheet(buffer)
    setFile(selected)
    setParsed(result)
    setMapping(suggestColumnMapping(result.headers))
    setStep('mapear')
  }

  async function handleEjecutar(forzarReimportacion = false) {
    if (!file) return
    setEjecutando(true)
    setArchivoRepetidoAviso(null)

    const supabase = createClient()
    const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
    const empresaId = empresas?.[0]?.id

    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const archivoHash = Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    const response = await fetch('/api/platform/importaciones/ejecutar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archivoNombre: file.name,
        archivoHash,
        empresaId,
        forzarReimportacion,
        rows: mappedRows.filter((_, index) => !excludedRows.has(index)),
      }),
    })

    if (response.status === 409) {
      const data = await response.json()
      setArchivoRepetidoAviso(data.mensaje)
      setEjecutando(false)
      return
    }

    const data = await response.json()
    setResumen({ filasProcesadas: data.filasProcesadas, filasRechazadas: data.filasRechazadas })
    setEjecutando(false)
    setStep('resumen')
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Importar datos</h1>

      {step === 'subir' ? <FileDropzone onFileSelected={handleFileSelected} /> : null}

      {step === 'mapear' && parsed && mapping ? (
        <ColumnMappingStep
          headers={parsed.headers}
          mapping={mapping}
          onChange={(field, header) => setMapping((prev) => (prev ? { ...prev, [field]: header } : prev))}
          onConfirm={() => setStep('validar')}
        />
      ) : null}

      {step === 'validar' ? (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Calidad de datos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {validation.resumen.criticos} errores críticos (excluidos de la importación),{' '}
              {validation.resumen.advertencias} advertencias.
            </p>
          </div>
          <QualityErrorsTable filaErrors={validation.filaErrors} />
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Vista previa</h2>
            <div className="mt-3">
              <ImportPreviewTable rows={mappedRows} excludedRows={excludedRows} />
            </div>
          </div>
          <Button type="button" onClick={() => setStep('confirmar')}>
            Continuar a confirmación
          </Button>
        </div>
      ) : null}

      {step === 'confirmar' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se importarán {mappedRows.length - excludedRows.size} de {mappedRows.length} filas de &quot;{file?.name}&quot;.
            Las filas con errores críticos serán excluidas.
          </p>
          {archivoRepetidoAviso ? (
            <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{archivoRepetidoAviso}</p>
              <Button type="button" variant="outline" disabled={ejecutando} onClick={() => handleEjecutar(true)}>
                Reimportar de todas formas
              </Button>
            </div>
          ) : (
            <Button type="button" disabled={ejecutando} onClick={() => handleEjecutar(false)}>
              {ejecutando ? 'Importando…' : 'Ejecutar importación'}
            </Button>
          )}
        </div>
      ) : null}

      {step === 'resumen' && resumen ? (
        <ImportSummary filasProcesadas={resumen.filasProcesadas} filasRechazadas={resumen.filasRechazadas} />
      ) : null}
    </div>
  )
}

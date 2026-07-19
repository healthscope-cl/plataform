'use client'

import { useMemo, useState } from 'react'
import { parseSpreadsheet, type ParsedSpreadsheet } from '@/lib/ingestion/parseFile'
import { suggestColumnMapping, type CanonicalField } from '@/lib/ingestion/columnMapping'
import { validateRows, type MappedRow } from '@/lib/ingestion/validate'
import { FileDropzone } from '@/components/platform/import/FileDropzone'
import { ColumnMappingStep } from '@/components/platform/import/ColumnMappingStep'
import { QualityErrorsTable } from '@/components/platform/import/QualityErrorsTable'
import { ImportPreviewTable } from '@/components/platform/import/ImportPreviewTable'
import { Button } from '@/components/ui/button'

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
): MappedRow[] {
  return parsed.rows.map((row) => ({
    rut: mapping.rut ? String(row[mapping.rut] ?? '') || null : null,
    fechaInicio: mapping.fechaInicio ? String(row[mapping.fechaInicio] ?? '') || null : null,
    fechaFin: mapping.fechaFin ? String(row[mapping.fechaFin] ?? '') || null : null,
    dias: mapping.dias ? Number(row[mapping.dias]) : null,
    tipoAdministrativo: mapping.tipoAdministrativo ? String(row[mapping.tipoAdministrativo] ?? '') || null : null,
  }))
}

export default function ImportarPage() {
  const [step, setStep] = useState<WizardStep>('subir')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<Record<CanonicalField, string | null> | null>(null)

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
        <p className="text-sm text-muted-foreground">
          Confirmación y ejecución — continúa en la Tarea 10 ({file?.name}, {mappedRows.length - excludedRows.size}{' '}
          filas a importar).
        </p>
      ) : null}
    </div>
  )
}

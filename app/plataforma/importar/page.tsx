'use client'

import { useState } from 'react'
import { parseSpreadsheet, type ParsedSpreadsheet } from '@/lib/ingestion/parseFile'
import { suggestColumnMapping, type CanonicalField } from '@/lib/ingestion/columnMapping'
import { FileDropzone } from '@/components/platform/import/FileDropzone'
import { ColumnMappingStep } from '@/components/platform/import/ColumnMappingStep'

type WizardStep = 'subir' | 'mapear' | 'validar' | 'confirmar' | 'resumen'

export default function ImportarPage() {
  const [step, setStep] = useState<WizardStep>('subir')
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<Record<CanonicalField, string | null> | null>(null)

  async function handleFileSelected(file: File) {
    const buffer = await file.arrayBuffer()
    const result = parseSpreadsheet(buffer)
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
        <p className="text-sm text-muted-foreground">Validación — continúa en la Tarea 9.</p>
      ) : null}
    </div>
  )
}

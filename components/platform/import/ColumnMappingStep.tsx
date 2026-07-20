'use client'

import { CANONICAL_FIELDS, type CanonicalField } from '@/lib/ingestion/columnMapping'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const FIELD_LABELS: Record<CanonicalField, string> = {
  rut: 'RUT (obligatorio)',
  fechaInicio: 'Fecha de inicio (obligatorio)',
  fechaFin: 'Fecha de fin',
  dias: 'Días de ausencia (obligatorio)',
  tipoAdministrativo: 'Tipo administrativo (obligatorio)',
  codigoPersona: 'Código de persona',
  sucursal: 'Sucursal',
  unidad: 'Unidad',
  cargo: 'Cargo',
  turno: 'Turno',
}

export function ColumnMappingStep({
  headers,
  mapping,
  onChange,
  onConfirm,
}: {
  headers: string[]
  mapping: Record<CanonicalField, string | null>
  onChange: (field: CanonicalField, header: string | null) => void
  onConfirm: () => void
}) {
  const requiredFields: CanonicalField[] = ['rut', 'fechaInicio', 'dias', 'tipoAdministrativo']
  const missingRequired = requiredFields.filter((field) => !mapping[field])

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">Mapear columnas</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {CANONICAL_FIELDS.map((field) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field} className="text-sm text-muted-foreground">
              {FIELD_LABELS[field]}
            </Label>
            <Select
              value={mapping[field] ?? '__none__'}
              onValueChange={(value) => onChange(field, value === '__none__' ? null : value)}
            >
              <SelectTrigger id={field} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin mapear</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {missingRequired.length > 0 ? (
        <p className="text-sm text-destructive" role="alert">
          Faltan campos obligatorios: {missingRequired.map((field) => FIELD_LABELS[field]).join(', ')}.
        </p>
      ) : null}
      <Button type="button" disabled={missingRequired.length > 0} onClick={onConfirm}>
        Continuar
      </Button>
    </div>
  )
}

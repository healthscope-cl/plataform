'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'

export function FileDropzone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">Selecciona un archivo Excel (.xlsx) o CSV.</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleChange}
        className="hidden"
        aria-label="Seleccionar archivo de importación"
      />
      <Button type="button" className="mt-4" onClick={() => inputRef.current?.click()}>
        Elegir archivo
      </Button>
    </div>
  )
}

'use client'

import { Button } from '@/components/ui/button'

export function ImprimirButton() {
  return (
    <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      Imprimir
    </Button>
  )
}

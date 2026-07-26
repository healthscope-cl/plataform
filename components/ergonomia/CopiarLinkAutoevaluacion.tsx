'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopiarLinkAutoevaluacion({ personaId }: { personaId: string }) {
  const [copiado, setCopiado] = useState(false)

  function copiar() {
    const url = `${window.location.origin}/autoevaluacion/${personaId}`
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar}>
      {copiado ? 'Copiado' : 'Copiar link de autoevaluación'}
    </Button>
  )
}

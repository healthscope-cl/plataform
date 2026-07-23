'use client'

import { useRouter } from 'next/navigation'
import type { Empresa, Rol, Usuario } from '@/lib/platform/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { EmpresaSwitcher } from './EmpresaSwitcher'

export function Topbar({
  usuario,
  rol,
  empresas,
}: {
  usuario: Usuario
  rol: Rol
  empresas: Empresa[]
}) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3 print:hidden">
      <EmpresaSwitcher empresas={empresas} />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{usuario.nombre}</p>
          <p className="text-xs text-muted-foreground">{rol.nombre}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  )
}

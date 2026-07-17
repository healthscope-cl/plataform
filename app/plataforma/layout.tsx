import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow, mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { Sidebar } from '@/components/platform/Sidebar'
import { Topbar } from '@/components/platform/Topbar'

export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()

  if (!usuarioRow) {
    redirect('/login')
  }

  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresaRows } = await supabase.from('empresas').select('*')
  const empresas = (empresaRows ?? []).map(mapEmpresaRow)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar rolClave={rol.clave} />
      <div className="flex flex-1 flex-col">
        <Topbar usuario={usuario} rol={rol} empresas={empresas} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

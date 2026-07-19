import Link from 'next/link'
import { isAdminRole } from '@/lib/platform/roles'

const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true },
] as const

export function Sidebar({ rolClave }: { rolClave: string }) {
  const isAdmin = isAdminRole(rolClave)

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-card p-4">
      <ul className="space-y-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

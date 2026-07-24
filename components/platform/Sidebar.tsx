import Link from 'next/link'
import { isAdminRole } from '@/lib/platform/roles'

const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/ausencias', label: 'Ausencias y licencias', adminOnly: true },
  { href: '/plataforma/reportes', label: 'Reportes', adminOnly: false },
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true },
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true },
  { href: '/plataforma/bienestar', label: 'Bienestar preventivo', adminOnly: true },
  { href: '/plataforma/seguridad', label: 'Seguridad laboral', adminOnly: true },
  { href: '/plataforma/ergonomia', label: 'Ergonomía', adminOnly: true },
  { href: '/plataforma/intervenciones', label: 'Intervenciones', adminOnly: true },
  { href: '/plataforma/campanas', label: 'Campañas', adminOnly: true },
  { href: '/plataforma/profesionales', label: 'Profesionales', adminOnly: true },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/calidad-datos', label: 'Calidad de datos', adminOnly: true },
  { href: '/plataforma/integraciones', label: 'Integraciones', adminOnly: true },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true },
] as const

export function Sidebar({ rolClave }: { rolClave: string }) {
  const isAdmin = isAdminRole(rolClave)

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-card p-4 print:hidden">
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

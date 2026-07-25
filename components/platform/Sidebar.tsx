'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarX,
  FileBarChart2,
  Bell,
  Lightbulb,
  ClipboardList,
  HeartPulse,
  ShieldAlert,
  Accessibility,
  Target,
  Megaphone,
  Stethoscope,
  Building2,
  Upload,
  History,
  BadgeCheck,
  Plug,
  UserCog,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import { isAdminRole } from '@/lib/platform/roles'

const NAV_ITEMS: { href: string; label: string; adminOnly: boolean; icon: LucideIcon }[] = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false, icon: LayoutDashboard },
  { href: '/plataforma/ausencias', label: 'Ausencias y licencias', adminOnly: true, icon: CalendarX },
  { href: '/plataforma/reportes', label: 'Reportes', adminOnly: false, icon: FileBarChart2 },
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true, icon: Bell },
  { href: '/plataforma/recomendaciones', label: 'Recomendaciones', adminOnly: true, icon: Lightbulb },
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true, icon: ClipboardList },
  { href: '/plataforma/bienestar', label: 'Bienestar preventivo', adminOnly: true, icon: HeartPulse },
  { href: '/plataforma/seguridad', label: 'Seguridad laboral', adminOnly: true, icon: ShieldAlert },
  { href: '/plataforma/ergonomia', label: 'Ergonomía', adminOnly: true, icon: Accessibility },
  { href: '/plataforma/intervenciones', label: 'Intervenciones', adminOnly: true, icon: Target },
  { href: '/plataforma/campanas', label: 'Campañas', adminOnly: true, icon: Megaphone },
  { href: '/plataforma/profesionales', label: 'Profesionales', adminOnly: true, icon: Stethoscope },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true, icon: Building2 },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true, icon: Upload },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true, icon: History },
  { href: '/plataforma/calidad-datos', label: 'Calidad de datos', adminOnly: true, icon: BadgeCheck },
  { href: '/plataforma/integraciones', label: 'Integraciones', adminOnly: true, icon: Plug },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true, icon: UserCog },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true, icon: ScrollText },
] as const

export function Sidebar({ rolClave }: { rolClave: string }) {
  const isAdmin = isAdminRole(rolClave)
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  // Pick the single most specific match (longest href) as active, so a route like
  // /plataforma/importar/historial doesn't also light up the parent /plataforma/importar item.
  const activeHref = visibleItems
    .filter((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 print:hidden">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
        <span className="font-heading text-base font-semibold text-sidebar-foreground">HealthScope</span>
      </div>
      <ul className="space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = item.href === activeHref
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground')
                }
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

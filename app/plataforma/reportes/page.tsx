import Link from 'next/link'

const REPORTES = [
  {
    href: '/plataforma/reportes/ejecutivo',
    nombre: 'Ejecutivo',
    descripcion: 'Resumen general de indicadores, alertas, seguridad y campañas.',
  },
  {
    href: '/plataforma/reportes/recursos-humanos',
    nombre: 'Recursos Humanos',
    descripcion: 'Indicadores de ausentismo, costo por persona y distribución por tipo de licencia.',
  },
  {
    href: '/plataforma/reportes/prevencion',
    nombre: 'Prevención',
    descripcion: 'Eventos de seguridad, evaluaciones ergonómicas y campañas preventivas activas.',
  },
  {
    href: '/plataforma/reportes/gerencia',
    nombre: 'Gerencia',
    descripcion: 'Vista de alto nivel: suficiencia de datos, costo estimado, alertas y campañas.',
  },
  {
    href: '/plataforma/reportes/campanas',
    nombre: 'Campañas',
    descripcion: 'Todas las campañas y su seguimiento antes/después cuando está configurado.',
  },
  {
    href: '/plataforma/reportes/calidad',
    nombre: 'Calidad',
    descripcion: 'Resumen de errores de calidad de las importaciones recientes.',
  },
  {
    href: '/plataforma/reportes/privacidad',
    nombre: 'Privacidad',
    descripcion: 'Principios de privacidad aplicados y supresión de grupos pequeños.',
  },
] as const

export default function ReportesMenuPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Elige un reporte para verlo en detalle.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTES.map((reporte) => (
          <Link
            key={reporte.href}
            href={reporte.href}
            className="rounded-2xl border border-border bg-card p-5 hover:bg-muted"
          >
            <p className="font-heading text-lg font-semibold text-foreground">{reporte.nombre}</p>
            <p className="mt-1 text-sm text-muted-foreground">{reporte.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

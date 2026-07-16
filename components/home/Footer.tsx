import { footer } from '@/lib/home/content'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-[#03142F] px-6 py-16 text-white/70">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="HealthScope" width={36} height={36} className="rounded" />
            <span className="font-heading text-base font-semibold text-white">HealthScope</span>
          </div>
          <p className="mt-4 max-w-xs text-sm">{footer.tagline}</p>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold text-white">Producto</h3>
          <ul className="mt-4 space-y-2">
            {footer.producto.map((item) => (
              <li key={item.label}>
                <a href={item.href} className="text-sm transition-colors hover:text-[#00B8F5]">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold text-white">Legal</h3>
          <ul className="mt-4 space-y-2">
            {footer.legal.map((item) => (
              <li key={item} className="text-sm text-white/40">
                {item} <span className="text-xs">(próximamente)</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6 text-xs text-white/40">
        {footer.copyright}
      </div>
    </footer>
  )
}

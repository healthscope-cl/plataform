import { ShieldCheck } from 'lucide-react'
import { trustStrip } from '@/lib/home/content'

export function TrustStrip() {
  return (
    <section className="bg-[#F4F7FB] px-6 py-10">
      <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {trustStrip.map((label) => (
          <li key={label} className="flex items-center gap-2 text-sm text-[#48556A]">
            <ShieldCheck className="h-4 w-4 text-[#00B8F5]" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}

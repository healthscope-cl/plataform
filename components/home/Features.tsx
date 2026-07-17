'use client'

import {
  Activity,
  Tags,
  Map,
  Bell,
  ClipboardList,
  Megaphone,
  Users,
  TrendingUp,
  FileBarChart,
  Plug,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react'
import { useHomeContent } from '@/lib/home/LocaleProvider'

const icons = [
  Activity,
  Tags,
  Map,
  Bell,
  ClipboardList,
  Megaphone,
  Users,
  TrendingUp,
  FileBarChart,
  Plug,
  ShieldCheck,
  ClipboardCheck,
]

export function Features() {
  const { features } = useHomeContent()

  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{features.titulo}</h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.tarjetas.map((tarjeta, index) => {
          const Icon = icons[index % icons.length]
          return (
            <div key={tarjeta} className="flex items-center gap-3 rounded-2xl border border-[#48556A]/10 bg-[#F4F7FB] p-5">
              <Icon className="h-5 w-5 shrink-0 text-[#00B8F5]" aria-hidden="true" />
              <p className="text-sm font-medium text-[#101827]">{tarjeta}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

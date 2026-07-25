'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  actual: { label: 'Actual', color: 'var(--chart-1)' },
  base: { label: 'Línea base', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function IndicadorMiniChart({ actual, base }: { actual: number; base: number | null }) {
  const data = base === null ? [{ nombre: 'valor', actual }] : [{ nombre: 'valor', actual, base }]

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-[56px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nombre" hide />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={4} barSize={14} />
        {base !== null ? <Bar dataKey="base" fill="var(--color-base)" radius={4} barSize={14} /> : null}
      </BarChart>
    </ChartContainer>
  )
}

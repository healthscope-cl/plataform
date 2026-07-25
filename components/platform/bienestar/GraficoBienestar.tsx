'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  promedio: { label: 'Promedio', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function GraficoBienestar({ datos }: { datos: Array<{ pregunta: string; promedio: number }> }) {
  if (datos.length === 0) return null

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <BarChart data={datos} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 5]} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="pregunta" tickLine={false} axisLine={false} width={110} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="promedio" fill="var(--color-promedio)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

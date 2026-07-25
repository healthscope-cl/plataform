'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  antes: { label: 'Antes', color: 'var(--chart-1)' },
  despues: { label: 'Después', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function GraficoAntesDespues({
  antes,
  despues,
  unidad,
}: {
  antes: number
  despues: number
  unidad?: string
}) {
  const data = [{ nombre: unidad ?? 'Comparación', antes, despues }]

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="antes" fill="var(--color-antes)" radius={4} />
        <Bar dataKey="despues" fill="var(--color-despues)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

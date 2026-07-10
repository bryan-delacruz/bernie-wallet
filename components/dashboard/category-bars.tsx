"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";

export type CategoryDatum = { label: string; amount: number };

// Magnitud (una sola medida) → un solo tono esmeralda, no arcoíris.
const config = { amount: { label: "Gasto", color: "var(--chart-1)" } } satisfies ChartConfig;

export function CategoryBars({ items, currency }: { items: CategoryDatum[]; currency: string }) {
  if (items.length === 0) return null;
  // Headroom en el eje para que la etiqueta del monto no se corte al borde.
  const max = Math.max(...items.map((i) => i.amount), 1);

  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={items} layout="vertical" margin={{ left: 4, right: 64 }}>
        <XAxis type="number" domain={[0, max * 1.25]} hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={100}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          cursor={false}
          isAnimationActive={false}
          wrapperStyle={{ transition: "none" }}
          content={
            <ChartTooltipContent formatter={(value) => formatCurrency(Number(value), currency)} />
          }
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="amount"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={11}
            formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

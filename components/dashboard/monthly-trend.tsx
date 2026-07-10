"use client";

import { Bar, BarChart, Cell, LabelList, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";

export type MonthDatum = { label: string; total: number; current?: boolean };

// Una medida en el tiempo → un tono; el mes actual resalta (opacidad).
const config = { total: { label: "Gasto", color: "var(--chart-1)" } } satisfies ChartConfig;

// Monto compacto para la etiqueta encima de la columna (6 columnas → poco ancho).
function shortAmount(value: number, currency: string): string {
  if (value <= 0) return "";
  const symbol = currency === "USD" ? "$" : "S/";
  const n =
    value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(Math.round(value));
  return `${symbol}${n}`;
}

export function MonthlyTrend({ months, currency }: { months: MonthDatum[]; currency: string }) {
  return (
    <ChartContainer config={config} className="h-[168px] w-full">
      <BarChart accessibilityLayer data={months} margin={{ left: 4, right: 4, top: 20 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrency(Number(value), currency)}
              labelFormatter={(label) => String(label)}
            />
          }
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {months.map((m) => (
            <Cell key={m.label} fill="var(--color-total)" fillOpacity={m.current ? 1 : 0.3} />
          ))}
          <LabelList
            dataKey="total"
            position="top"
            offset={6}
            className="fill-foreground"
            fontSize={10}
            formatter={(value) => shortAmount(Number(value ?? 0), currency)}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

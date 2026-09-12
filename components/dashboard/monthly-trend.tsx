"use client";

import { Bar, BarChart, Cell, LabelList, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";

export type MonthDatum = {
  label: string;
  total: number;
  /** Excedente estimado hasta fin de mes (solo el mes en curso). */
  projected?: number;
  current?: boolean;
};

// Una medida en el tiempo → un tono; el mes actual resalta (opacidad). El
// excedente proyectado usa el mismo tono translúcido: es la misma magnitud, pero
// estimada, y no debe leerse como gasto ya ocurrido.
const config = {
  total: { label: "Gastado", color: "var(--chart-1)" },
  projected: { label: "Proyectado", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Monto compacto para la etiqueta encima de la columna (6 columnas → poco ancho).
function shortAmount(value: number, currency: string): string {
  if (value <= 0) return "";
  const symbol = currency === "USD" ? "$" : "S/";
  const n =
    value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(Math.round(value));
  return `${symbol}${n}`;
}

export function MonthlyTrend({ months, currency }: { months: MonthDatum[]; currency: string }) {
  const hasProjection = months.some((m) => (m.projected ?? 0) > 0);
  const currentLabel = months.find((m) => m.current)?.label;

  // La etiqueta directa se omite en la columna con proyección apilada: ahí el número
  // quedaría bajo el segmento estimado y se leería como el total del mes. Se controla
  // por dato (labelValue = 0 → sin etiqueta) para que Recharts siga posicionando.
  const data = months.map((m) => ({
    ...m,
    labelValue: (m.projected ?? 0) > 0 ? 0 : m.total,
  }));

  return (
    <div className="space-y-2">
      <ChartContainer config={config} className="h-[168px] w-full">
        <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 20 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) =>
              `${v.charAt(0).toUpperCase()}${v.slice(1)}${v === currentLabel ? " ·" : ""}`
            }
          />
          <ChartTooltip
            cursor={false}
            isAnimationActive={false}
            wrapperStyle={{ transition: "none" }}
            content={
              <ChartTooltipContent
                formatter={(value) => formatCurrency(Number(value), currency)}
                labelFormatter={(label) => String(label)}
              />
            }
          />
          <Bar dataKey="total" stackId="month" radius={[4, 4, 0, 0]}>
            {months.map((m) => (
              <Cell key={m.label} fill="var(--color-total)" fillOpacity={m.current ? 1 : 0.3} />
            ))}
            <LabelList
              dataKey="labelValue"
              position="top"
              offset={6}
              className="fill-foreground"
              fontSize={10}
              formatter={(value) => shortAmount(Number(value ?? 0), currency)}
            />
          </Bar>
          {hasProjection && (
            <Bar
              dataKey="projected"
              stackId="month"
              radius={[4, 4, 0, 0]}
              fill="var(--color-projected)"
              fillOpacity={0.22}
              stroke="var(--card)"
              strokeWidth={2}
            />
          )}
        </BarChart>
      </ChartContainer>

      {hasProjection && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--chart-1)]" />
            Gastado
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--chart-1)]/25 ring-1 ring-border" />
            Proyectado
          </li>
          <li>· mes en curso</li>
        </ul>
      )}
    </div>
  );
}

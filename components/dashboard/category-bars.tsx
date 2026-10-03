"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { categoryChartHeight } from "./chart-metrics";
import { cn } from "@/lib/utils";

/** `id` solo viene en el nivel de categorías: es lo que permite entrar al desglose. */
export type CategoryDatum = { label: string; amount: number; id?: string };

type SortMode = "amount" | "name";

// Magnitud (una sola medida) → un solo tono esmeralda, no arcoíris.
const config = { amount: { label: "Gasto", color: "var(--chart-1)" } } satisfies ChartConfig;

export function CategoryBars({
  items,
  currency,
  drillable = false,
}: {
  items: CategoryDatum[];
  currency: string;
  /** En el nivel de categorías, un clic filtra por esa categoría y entra a sus
   *  subcategorías. Dentro del desglose ya no hay otro nivel al que bajar. */
  drillable?: boolean;
}) {
  const [sort, setSort] = useState<SortMode>("amount");
  const reducedMotion = usePrefersReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const drillInto = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("cat", id);
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  if (items.length === 0) return null;

  // "Otros" (bucket de sobrantes) siempre al final, sin importar el orden elegido.
  const sorted = [...items].sort((a, b) => {
    if (a.label === "Otros") return 1;
    if (b.label === "Otros") return -1;
    return sort === "amount" ? b.amount - a.amount : a.label.localeCompare(b.label, "es");
  });
  // Headroom en el eje para que la etiqueta del monto no se corte al borde.
  const max = Math.max(...sorted.map((i) => i.amount), 1);
  // Alto derivado de las filas: con un alto fijo, una sola categoría producía una
  // barra desproporcionada y seis quedaban apretadas. La página reserva este mismo
  // alto mientras carga el chunk de Recharts.
  const chartHeight = categoryChartHeight(sorted.length);

  return (
    <div className="space-y-3">
      {items.length > 1 && (
        <div className="flex justify-end">
          <SortToggle value={sort} onChange={setSort} />
        </div>
      )}

      <ChartContainer config={config} className="w-full" style={{ height: chartHeight }}>
        <BarChart accessibilityLayer data={sorted} layout="vertical" margin={{ left: 4, right: 64 }}>
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
          <Bar
            dataKey="amount"
            fill="var(--color-amount)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={!reducedMotion}
            cursor={drillable ? "pointer" : undefined}
            onClick={
              drillable
                ? (data: { payload?: CategoryDatum }) => {
                    if (data.payload?.id) drillInto(data.payload.id);
                  }
                : undefined
            }
          >
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
    </div>
  );
}

/** Segmento de orden: por monto (default) o alfabético. */
function SortToggle({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  const options: [SortMode, string][] = [
    ["amount", "Monto"],
    ["name", "A–Z"],
  ];
  return (
    <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            value === v
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

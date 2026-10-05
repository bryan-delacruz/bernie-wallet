"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
import { CATEGORY_TOP_N, categoryChartHeight, collapsedRowCount } from "./chart-metrics";
import { cn } from "@/lib/utils";

/** `id` solo viene en el nivel de categorías: es lo que permite entrar al desglose.
 *  `bucket` marca la barra que agrupa el resto; no tiene id ni drill-down. */
export type CategoryDatum = { label: string; amount: number; id?: string; bucket?: boolean };

type SortMode = "amount" | "name";

// Magnitud (una sola medida) → un solo tono esmeralda, no arcoíris.
const config = { amount: { label: "Gasto", color: "var(--chart-1)" } } satisfies ChartConfig;

export function CategoryBars({
  items,
  currency,
  drillable = false,
}: {
  /** Todas las categorías del período, ya ordenadas por monto. El recorte a top 5
   *  vive acá y no en la página: así "ver todas" no necesita otro request. */
  items: CategoryDatum[];
  currency: string;
  /** En el nivel de categorías, un clic filtra por esa categoría y entra a sus
   *  subcategorías. Dentro del desglose ya no hay otro nivel al que bajar. */
  drillable?: boolean;
}) {
  const [sort, setSort] = useState<SortMode>("amount");
  const [expanded, setExpanded] = useState(false);
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

  // El resto se agrupa en una barra rotulada por cantidad ("+3 categorías"), nunca
  // por nombre: "Otros" es también una categoría real del seed y se confundían.
  const collapsible = items.length > collapsedRowCount(items.length);
  const visible = useMemo(() => {
    if (!collapsible || expanded) return items;
    const rest = items.slice(CATEGORY_TOP_N);
    const total = rest.reduce((sum, item) => sum + item.amount, 0);
    return [
      ...items.slice(0, CATEGORY_TOP_N),
      {
        label: rest.length === 1 ? "+1 categoría" : `+${rest.length} categorías`,
        amount: total,
        bucket: true,
      },
    ];
  }, [items, collapsible, expanded]);

  if (items.length === 0) return null;

  // La barra agrupada siempre al final, sin importar el orden elegido.
  const sorted = [...visible].sort((a, b) => {
    if (a.bucket) return 1;
    if (b.bucket) return -1;
    return sort === "amount" ? b.amount - a.amount : a.label.localeCompare(b.label, "es");
  });
  // Headroom en el eje para que la etiqueta del monto no se corte al borde.
  const max = Math.max(...sorted.map((i) => i.amount), 1);
  // Alto derivado de las filas: con un alto fijo, una sola categoría producía una
  // barra desproporcionada y seis quedaban apretadas. La página reserva este mismo
  // alto mientras carga el chunk de Recharts.
  const chartHeight = categoryChartHeight(sorted.length, !expanded);

  return (
    <div className="space-y-3">
      {(items.length > 1 || collapsible) && (
        <div className="flex items-center justify-end gap-3">
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {expanded ? "Ver menos" : `Ver todas (${items.length})`}
            </button>
          )}
          {items.length > 1 && <SortToggle value={sort} onChange={setSort} />}
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
            cursor={drillable || collapsible ? "pointer" : undefined}
            onClick={(data: { payload?: CategoryDatum }) => {
              // Sobre la barra agrupada el clic abre el detalle, que es lo que el
              // usuario busca al tocarla; no hay categoría a la que bajar.
              if (data.payload?.bucket) setExpanded(true);
              else if (drillable && data.payload?.id) drillInto(data.payload.id);
            }}
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

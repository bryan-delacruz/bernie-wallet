"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";

export type SplitDatum = { label: string; amount: number; color: string };

// Composición categórica → donut + leyenda rica (monto y %) para leerlo sin hover.
export function PaymentSplit({ items, currency }: { items: SplitDatum[]; currency: string }) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + i.amount, 0);

  const config: ChartConfig = Object.fromEntries(
    items.map((i) => [i.label, { label: i.label, color: i.color }]),
  );

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <ChartContainer config={config} className="aspect-square h-[168px] shrink-0">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="label"
                formatter={(value) => formatCurrency(Number(value), currency)}
              />
            }
          />
          <Pie data={items} dataKey="amount" nameKey="label" innerRadius={48} strokeWidth={2}>
            {items.map((i) => (
              <Cell key={i.label} fill={i.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="w-full flex-1 space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
            <span className="flex-1 truncate text-muted-foreground">{i.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatCurrency(i.amount, currency)}
            </span>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((i.amount / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

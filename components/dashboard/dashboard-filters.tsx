"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTROL_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type NamedOption = { id: string; label: string };

/** Filtros del dashboard (estado en la URL): rango de fechas, categorías (multi) y
 *  medio de pago. El server recalcula métricas y gráficos a partir de los searchParams. */
export function DashboardFilters({
  categories,
  methods,
}: {
  categories: NamedOption[];
  methods: NamedOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const method = params.get("method") ?? "";
  const selectedCats = (params.get("cat") ?? "").split(",").filter(Boolean);
  const hasFilters = Boolean(from || to || method || selectedCats.length);

  function toggleCat(id: string) {
    const next = selectedCats.includes(id)
      ? selectedCats.filter((x) => x !== id)
      : [...selectedCats, id];
    setParam("cat", next.join(","));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Desde
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setParam("from", e.target.value)}
            className={CONTROL_CLASS}
            aria-label="Desde"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Hasta
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setParam("to", e.target.value)}
            className={CONTROL_CLASS}
            aria-label="Hasta"
          />
        </label>

        <select
          value={method}
          onChange={(e) => setParam("method", e.target.value)}
          className={CONTROL_CLASS}
          aria-label="Filtrar por medio de pago"
        >
          <option value="">Todos los medios</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            className="h-9 gap-1.5"
          >
            <X className="size-4" />
            Limpiar
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => {
            const active = selectedCats.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCat(c.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

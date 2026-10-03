"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { limaToday, shiftDay } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Atajos de rango. `null` = sin fechas en la URL, que el dashboard lee como mes actual. */
const RANGE_PRESETS: { key: string; label: string; shift: { days?: number; months?: number } | null }[] =
  [
    { key: "month", label: "Este mes", shift: null },
    { key: "7d", label: "7 días", shift: { days: 6 } },
    { key: "15d", label: "15 días", shift: { days: 14 } },
    { key: "30d", label: "30 días", shift: { days: 29 } },
    { key: "3m", label: "3 meses", shift: { months: 3, days: -1 } },
    { key: "6m", label: "6 meses", shift: { months: 6, days: -1 } },
  ];

const CONTROL_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LABEL_CLASS = "text-xs font-medium tracking-wide text-muted-foreground uppercase";

type NamedOption = { id: string; label: string };

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`),
  );

/** Filtros del dashboard (estado en la URL): rango de fechas, categorías (multi) y
 *  medio de pago. Desktop: barra inline. Móvil: botón + chips activos + bottom-sheet
 *  (para dejar el alto a los gráficos). Por defecto, sin filtros = mes actual. */
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

  const toggleCat = useCallback(
    (id: string) => {
      const next = selectedCats.includes(id)
        ? selectedCats.filter((x) => x !== id)
        : [...selectedCats, id];
      setParam("cat", next.join(","));
    },
    [selectedCats, setParam],
  );

  const clearAll = useCallback(
    () => startTransition(() => router.replace(pathname, { scroll: false })),
    [pathname, router],
  );

  /** Aplica un atajo: escribe `from`/`to` de una sola vez (o los borra en "Este mes"). */
  const applyPreset = useCallback(
    (shift: { days?: number; months?: number } | null) => {
      const next = new URLSearchParams(params.toString());
      if (shift) {
        const today = limaToday();
        next.set("from", shiftDay(today, shift));
        next.set("to", today);
      } else {
        next.delete("from");
        next.delete("to");
      }
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  const clearDates = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }, [params, pathname, router]);

  const catLabel = new Map(categories.map((c) => [c.id, c.label]));
  const methodLabel = new Map(methods.map((m) => [m.id, m.label]));

  // Chips de filtros activos (para el resumen en móvil).
  const activeChips: { key: string; label: string; remove: () => void }[] = [];
  if (from || to) {
    activeChips.push({
      key: "date",
      label: from && to ? `${fmtDay(from)} – ${fmtDay(to)}` : from ? `Desde ${fmtDay(from)}` : `Hasta ${fmtDay(to)}`,
      remove: clearDates,
    });
  }
  for (const id of selectedCats) {
    activeChips.push({ key: `cat-${id}`, label: catLabel.get(id) ?? id, remove: () => toggleCat(id) });
  }
  if (method) {
    activeChips.push({ key: "method", label: methodLabel.get(method) ?? method, remove: () => setParam("method", "") });
  }

  // El atajo activo se deduce del rango en la URL, no de un estado aparte: así
  // sobrevive a recargas y a enlaces compartidos. `hoy` se calcula una vez por
  // render, no una por atajo.
  const today = limaToday();
  const activePreset = RANGE_PRESETS.find((preset) =>
    preset.shift ? to === today && from === shiftDay(today, preset.shift) : !from && !to,
  )?.key;

  // Control segmentado, no chips sueltos: el rango es UNA elección. Los chips
  // redondos de abajo son categorías, donde sí se activan varias — la forma dice
  // cuál es cuál sin necesidad de explicarlo.
  const presetChips = (
    <div
      role="group"
      aria-label="Rango rápido"
      className="inline-flex flex-wrap rounded-md border border-border p-0.5 text-xs"
    >
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => applyPreset(preset.shift)}
          aria-pressed={activePreset === preset.key}
          className={cn(
            "rounded px-2.5 py-1 transition-colors",
            activePreset === preset.key
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  const dateInputs = (fullWidth: boolean) => (
    <>
      <label className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", fullWidth && "flex-1 flex-col items-start")}>
        Desde
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setParam("from", e.target.value)}
          className={cn(CONTROL_CLASS, fullWidth && "w-full")}
          aria-label="Desde"
        />
      </label>
      <label className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", fullWidth && "flex-1 flex-col items-start")}>
        Hasta
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setParam("to", e.target.value)}
          className={cn(CONTROL_CLASS, fullWidth && "w-full")}
          aria-label="Hasta"
        />
      </label>
    </>
  );

  const methodSelect = (fullWidth: boolean) => (
    <select
      value={method}
      onChange={(e) => setParam("method", e.target.value)}
      className={cn(CONTROL_CLASS, fullWidth && "w-full")}
      aria-label="Filtrar por medio de pago"
    >
      <option value="">Todos los medios</option>
      {methods.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );

  const categoryChips = (
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
  );

  return (
    <>
      {/* Desktop: barra inline */}
      <div className="hidden space-y-3 sm:block">
        {presetChips}
        <div className="flex flex-wrap items-center gap-2">
          {dateInputs(false)}
          {methodSelect(false)}
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-9 gap-1.5">
              <X className="size-4" />
              Limpiar
            </Button>
          )}
        </div>
        {categories.length > 0 && categoryChips}
      </div>

      {/* Móvil: botón + chips activos + bottom-sheet */}
      <div className="sm:hidden">
        <Sheet>
          <div className="flex items-center gap-2">
            <SheetTrigger
              render={<Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" />}
            >
              <SlidersHorizontal className="size-4" />
              Filtros
              {activeChips.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {activeChips.length}
                </span>
              )}
            </SheetTrigger>

            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeChips.length === 0 ? (
                <span className="text-xs text-muted-foreground">Este mes</span>
              ) : (
                activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.remove}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-primary bg-primary/10 py-1 pr-1.5 pl-2.5 text-xs font-medium text-primary"
                  >
                    {chip.label}
                    <X className="size-3.5" />
                  </button>
                ))
              )}
            </div>
          </div>

          <SheetContent>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <SheetTitle>Filtros</SheetTitle>
              {hasFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1.5">
                  <X className="size-4" />
                  Limpiar
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                <p className={LABEL_CLASS}>Rango de fechas</p>
                {presetChips}
                <div className="flex gap-2">{dateInputs(true)}</div>
              </div>

              {categories.length > 0 && (
                <div className="space-y-2">
                  <p className={LABEL_CLASS}>Categorías</p>
                  {categoryChips}
                </div>
              )}

              <div className="space-y-2">
                <p className={LABEL_CLASS}>Medio de pago</p>
                {methodSelect(true)}
              </div>
            </div>

            <div className="flex gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <SheetClose render={<Button type="button" className="w-full" />}>Ver resultados</SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

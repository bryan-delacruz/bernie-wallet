"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const CONTROL_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LABEL_CLASS = "text-xs font-medium tracking-wide text-muted-foreground uppercase";

type NamedOption = { id: string; label: string };

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`),
  );

/** Filtros de actividad (estado en la URL). Búsqueda siempre visible. Desktop:
 *  barra inline. Móvil: botón + chips activos + bottom-sheet (fechas, categorías,
 *  medio, orden). Por defecto, sin filtros = mes actual + más reciente. */
export function ActivityFilters({
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
  const [search, setSearch] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  // Búsqueda con debounce (no una request por tecla).
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== search.trim()) setParam("q", search.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const method = params.get("method") ?? "";
  const sort = params.get("sort") ?? "recent";
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

  const clearAll = useCallback(() => {
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  const clearDates = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }, [params, pathname, router]);

  const catLabel = new Map(categories.map((c) => [c.id, c.label]));
  const methodLabel = new Map(methods.map((m) => [m.id, m.label]));

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

  const searchBox = (
    <div className="relative min-w-[9rem] flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar comercio…"
        className="h-9 pl-8"
        aria-label="Buscar por comercio"
      />
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

  const sortSelect = (fullWidth: boolean) => (
    <select
      value={sort}
      onChange={(e) => setParam("sort", e.target.value === "recent" ? "" : e.target.value)}
      className={cn(CONTROL_CLASS, fullWidth && "w-full")}
      aria-label="Ordenar"
    >
      <option value="recent">Más reciente</option>
      <option value="oldest">Más antiguo</option>
      <option value="amount-desc">Mayor monto</option>
      <option value="amount-asc">Menor monto</option>
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
    <div className="space-y-3">
      {/* Desktop: barra inline */}
      <div className="hidden space-y-3 sm:block">
        <div className="flex flex-wrap items-center gap-2">
          {searchBox}
          {dateInputs(false)}
          {methodSelect(false)}
          {sortSelect(false)}
          {(hasFilters || search) && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-9 gap-1.5">
              <X className="size-4" />
              Limpiar
            </Button>
          )}
        </div>
        {categories.length > 0 && categoryChips}
      </div>

      {/* Móvil: búsqueda + botón filtros + chips activos + bottom-sheet */}
      <div className="space-y-2 sm:hidden">
        {searchBox}
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
              <SheetTitle>Filtros y orden</SheetTitle>
              {(hasFilters || search) && (
                <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1.5">
                  <X className="size-4" />
                  Limpiar
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                <p className={LABEL_CLASS}>Rango de fechas</p>
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

              <div className="space-y-2">
                <p className={LABEL_CLASS}>Ordenar</p>
                {sortSelect(true)}
              </div>
            </div>

            <div className="flex gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <SheetClose render={<Button type="button" className="w-full" />}>Ver resultados</SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

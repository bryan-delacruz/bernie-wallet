"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { WeekStart } from "@/lib/streak";
import { updateWeekStart } from "@/app/(dashboard)/settings/actions";
import { cn } from "@/lib/utils";

const OPTIONS: { value: WeekStart; label: string }[] = [
  { value: "monday", label: "Lunes" },
  { value: "sunday", label: "Domingo" },
];

/** Primer día de la semana. Cambia dónde empieza cada columna de la grilla de
 *  racha, en la app y en la imagen que se comparte. */
export function WeekStartToggle({ value }: { value: WeekStart }) {
  const [current, setCurrent] = useState(value);
  const [, start] = useTransition();

  function choose(next: WeekStart) {
    if (next === current) return;
    const previous = current;
    setCurrent(next); // optimista: el control responde al toque, no al round-trip
    start(async () => {
      const result = await updateWeekStart(next);
      if (result.error) {
        setCurrent(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {OPTIONS.map(({ value: option, label }) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            aria-pressed={current === option}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              current === option
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Define dónde empieza cada semana en la grilla de tu racha.
      </p>
    </div>
  );
}

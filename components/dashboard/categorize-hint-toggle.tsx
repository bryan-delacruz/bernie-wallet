"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCategorizeHint } from "@/app/(dashboard)/settings/actions";
import { cn } from "@/lib/utils";

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Sí" },
  { value: false, label: "No" },
];

/** Avisar o no en Actividad cuando hay gastos sin categoría. */
export function CategorizeHintToggle({ value }: { value: boolean }) {
  const [current, setCurrent] = useState(value);
  const [, start] = useTransition();

  function choose(next: boolean) {
    if (next === current) return;
    const previous = current;
    setCurrent(next); // optimista: el control responde al toque, no al round-trip
    start(async () => {
      const result = await updateCategorizeHint(next);
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
            key={String(option)}
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
        Si lo apagas, el aviso no vuelve. En Actividad igual te queda un enlace
        discreto para ordenar cuando quieras.
      </p>
    </div>
  );
}

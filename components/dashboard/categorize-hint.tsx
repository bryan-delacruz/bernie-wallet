"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Wand2, X } from "lucide-react";
import { dismissCategorizeHint } from "@/app/(dashboard)/activity/actions";

/**
 * Aviso de Actividad para ordenar el backlog. Se puede cerrar, y en su lugar queda
 * un enlace de una línea: la puerta no desaparece, baja de volumen. Un modal para
 * explicar eso sería castigar al que acaba de pedir que no lo interrumpan.
 */
export function CategorizeHint({
  pendingExpenses,
  since,
}: {
  pendingExpenses: number;
  /** Pendientes nuevos desde el último descarte. 0 si nunca descartó. */
  since: number;
}) {
  const [hidden, setHidden] = useState(false);
  const [, startDismiss] = useTransition();

  if (hidden) return <CategorizeLink pendingExpenses={pendingExpenses} />;

  function dismiss() {
    setHidden(true); // optimista: cerrar responde al toque, no al round-trip
    startDismiss(async () => {
      const result = await dismissCategorizeHint();
      if (result.error) {
        setHidden(false);
        toast.error(result.error);
        return;
      }
      toast.success("Listo. Te dejo un enlace discreto en su lugar.");
    });
  }

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 pr-10">
      <Link href="/categorize" className="flex flex-1 items-center gap-3 px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wand2 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {since > 0
              ? `Se juntaron ${since} gastos más sin categoría`
              : `Ordena ${pendingExpenses} gastos sin categoría`}
          </span>
          <span className="block text-xs text-muted-foreground">
            {since > 0
              ? `Van ${pendingExpenses} en total. Agrupados por comercio, se ordenan rápido.`
              : "Agrupados por comercio: una decisión categoriza todos sus gastos."}
          </span>
        </span>
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar este aviso"
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** La versión callada del aviso: una línea, siempre disponible. */
export function CategorizeLink({ pendingExpenses }: { pendingExpenses: number }) {
  return (
    <Link
      href="/categorize"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Wand2 className="size-3.5" />
      Ordenar {pendingExpenses} gastos sin categoría
    </Link>
  );
}

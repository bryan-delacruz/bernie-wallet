import { cn } from "@/lib/utils";

export type StatTile = {
  label: string;
  value: string;
  hint?: string;
  /** Valor derivado (no medido): se rotula y atenúa para no leerse como un hecho. */
  estimate?: boolean;
};

/** Fila de KPIs. Jerarquía por peso+color: label tenue arriba, valor fuerte.
 *  Los tiles estiran a la altura de su contenedor (para emparejar con el saldo).
 *
 *  El layout responde al ancho del CONTENEDOR, no del viewport: con la barra lateral
 *  presente, a 1024px el contenido mide ~490px y tres columnas truncaban el monto
 *  proyectado. Por eso container queries y no breakpoints de pantalla. */
export function StatTiles({ tiles, className }: { tiles: StatTile[]; className?: string }) {
  const three = tiles.length >= 3;

  return (
    <div className={cn("@container h-full", className)}>
      <div className={cn("grid h-full grid-cols-2 gap-3", three && "@xl:grid-cols-3")}>
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              "flex min-w-0 flex-col justify-center overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4",
              // Con 3 tiles y 2 columnas, el último queda solo en la 2da fila: ocupa el
              // ancho completo hasta que haya sitio para la tercera columna.
              three && "last:col-span-2 @xl:last:col-span-1",
            )}
          >
            <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {t.label}
            </p>
            <p
              className={cn(
                "mt-1 truncate text-lg font-semibold tracking-tight tabular-nums @md:text-xl @2xl:text-2xl",
                t.estimate && "text-muted-foreground",
              )}
            >
              {t.estimate ? "≈ " : ""}
              {t.value}
            </p>
            {t.hint && <p className="truncate text-[11px] text-muted-foreground">{t.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

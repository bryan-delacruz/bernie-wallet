import { cn } from "@/lib/utils";

export type StatTile = {
  label: string;
  value: string;
  hint?: string;
  /** Valor derivado (no medido): se rotula y atenúa para no leerse como un hecho. */
  estimate?: boolean;
};

/** Fila de KPIs. Jerarquía por peso+color: label tenue arriba, valor fuerte.
 *  Los tiles estiran a la altura de su contenedor (para emparejar con el saldo). */
export function StatTiles({ tiles, className }: { tiles: StatTile[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid h-full grid-cols-2 gap-3",
        tiles.length >= 3 && "sm:grid-cols-3",
        className,
      )}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className={cn(
            "flex min-w-0 flex-col justify-center overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4",
            // Con 3 tiles el último cae solo en la 2da fila: a 320px necesita el ancho
            // completo para que un monto proyectado de 4 dígitos no se trunque.
            tiles.length === 3 && "max-sm:last:col-span-2",
          )}
        >
          <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t.label}
          </p>
          <p
            className={cn(
              "mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl",
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
  );
}

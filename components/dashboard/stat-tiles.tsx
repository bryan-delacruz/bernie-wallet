export type StatTile = { label: string; value: string; hint?: string };

/** Fila de KPIs. Jerarquía por peso+color: label tenue arriba, valor fuerte. */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t.label}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{t.value}</p>
          {t.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>}
        </div>
      ))}
    </div>
  );
}

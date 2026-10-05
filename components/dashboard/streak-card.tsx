import Link from "next/link";
import { Flame, Snowflake } from "lucide-react";
import type { StreakDay } from "@/lib/streak";
import { ShareStreakButton } from "@/components/dashboard/share-streak-button";
import { cn } from "@/lib/utils";

/** Color de cada estado de día en la grilla. El bronce marca lo que el usuario
 *  "salvó" (congelada) y lo que todavía puede salvar (hoy); el esmeralda, lo
 *  cumplido. Un día sin gastos cuenta, pero se pinta más tenue: no es lo mismo
 *  estar al día habiendo gastado que no haber gastado. */
const DAY_STYLE: Record<StreakDay["state"], string> = {
  clean: "bg-[var(--chart-1)]",
  quiet: "bg-[var(--chart-1)]/30",
  frozen: "bg-[#c9904e]",
  missed: "bg-muted-foreground/15",
  pending: "bg-muted-foreground/15 ring-1 ring-[#c9904e] ring-inset",
};

const DAY_LABEL: Record<StreakDay["state"], string> = {
  clean: "al día",
  quiet: "sin gastos",
  frozen: "cubierto con una congelada",
  missed: "quedó algo sin categorizar",
  pending: "hoy, pendiente",
};

export function StreakCard({
  current,
  longest,
  freezes,
  atRisk,
  backlog,
  days,
  daysWithoutSpending,
  totalExpenses,
}: {
  current: number;
  longest: number;
  freezes: number;
  atRisk: boolean;
  backlog: number;
  days: StreakDay[];
  daysWithoutSpending: number;
  totalExpenses: number;
}) {
  // La grilla se lee por columnas de semana, así que la primera columna arranca en
  // el día de la semana real del primer día; si no, los domingos no se alinean.
  const offset = days.length ? new Date(`${days[0].day}T00:00:00Z`).getUTCDay() : 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Tu racha
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <Flame className={cn("size-5 shrink-0", atRisk ? "text-[#c9904e]" : "text-[var(--chart-1)]")} />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{current}</span>
            <span className="text-sm text-muted-foreground">
              {current === 1 ? "día al día" : "días al día"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {atRisk
              ? "Te queda algo de hoy sin categorizar. Todavía estás a tiempo."
              : `Tu mejor racha: ${longest} ${longest === 1 ? "día" : "días"}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {freezes > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
              title="Cubren un día incumplido, sin que pierdas la racha"
            >
              <Snowflake className="size-3.5" aria-hidden />
              {freezes}
            </span>
          )}
          <ShareStreakButton />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div
          className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
          role="img"
          aria-label={`Grilla de los últimos ${days.length} días: ${current} días seguidos al día.`}
        >
          {offset > 0 && <span style={{ gridRow: `span ${offset}` }} aria-hidden />}
          {days.map((d) => (
            <span
              key={d.day}
              title={`${d.day} · ${DAY_LABEL[d.state]}`}
              className={cn("size-[9px] rounded-[2px]", DAY_STYLE[d.state])}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{totalExpenses}</span>{" "}
          {totalExpenses === 1 ? "gasto anotado" : "gastos anotados"}
        </span>
        {daysWithoutSpending > 0 && (
          <span>
            <span className="font-medium text-foreground tabular-nums">{daysWithoutSpending}</span>{" "}
            {daysWithoutSpending === 1 ? "día sin gastar" : "días seguidos sin gastar"}
          </span>
        )}
        {backlog > 0 && (
          <Link
            href="/activity"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Ponerte al día: {backlog} sin categoría
          </Link>
        )}
      </div>
    </section>
  );
}

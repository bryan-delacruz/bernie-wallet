import Link from "next/link";
import { Flame, Snowflake } from "lucide-react";
import { weekdayIndex, type StreakDay, type WeekStart } from "@/lib/streak";
import { ShareStreakButton } from "@/components/dashboard/share-streak-button";
import { cn } from "@/lib/utils";

/** Dos tonos, los mismos que en la imagen compartible: el día contó o no contó.
 *  Lo que ves en la app tiene que ser lo que compartes, así que un día cubierto por
 *  una congelada se pinta como contado —porque contó— y el detalle vive en el
 *  tooltip. Un día sin gastos cuenta, pero va más tenue: no es lo mismo estar al
 *  día habiendo gastado que no haber gastado. El anillo de hoy es lo único propio
 *  de la app: marca lo que todavía puedes salvar, y en la imagen no tiene sentido. */
const DAY_STYLE: Record<StreakDay["state"], string> = {
  clean: "bg-[var(--chart-1)]",
  quiet: "bg-[var(--chart-1)]/30",
  frozen: "bg-[var(--chart-1)]",
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
  weekStart,
}: {
  current: number;
  longest: number;
  freezes: number;
  atRisk: boolean;
  backlog: number;
  days: StreakDay[];
  daysWithoutSpending: number;
  totalExpenses: number;
  weekStart: WeekStart;
}) {
  const weeks = toWeeks(days, weekStart);
  const weekdayLabels = WEEKDAY_LABELS[weekStart];

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Tu racha
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <Flame className={cn("size-5 shrink-0", atRisk ? "text-[#c9904e]" : "text-[var(--chart-1)]")} />
            <span className="font-heading text-3xl font-medium tracking-tight tabular-nums">
              {current}
            </span>
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

        <div className="ml-auto flex items-center gap-2">
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

      {/* El eje de días queda fuera del área que scrollea: con un año de datos la
          grilla no entra en pantalla y, si el eje viaja con ella, se pierde la
          referencia justo cuando hace falta. */}
      <div className="mt-4 flex gap-1.5">
        {/* Eje de días: solo lunes, miércoles y viernes. Las siete iniciales
            juntas no entran a 9px, y en español M y S se repiten. */}
        <div className="mt-4 grid grid-rows-7 gap-[3px] text-[9px] leading-[9px] text-muted-foreground">
          {weekdayLabels.map((label, i) => (
            <span key={i} className="h-[9px]">
              {label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
            {/* Eje de meses: la etiqueta se ancla a la columna donde empieza el mes
                y se desborda a la derecha, que es más angosta que el texto. */}
            <div className="mb-1 flex h-3 gap-[3px] text-[9px] leading-3 text-muted-foreground">
              {weeks.map((week, w) => (
                <span key={w} className="relative w-[9px] shrink-0">
                  {monthStart(week) && (
                    <span className="absolute top-0 left-0 whitespace-nowrap">
                      {monthStart(week)}
                    </span>
                  )}
                </span>
              ))}
            </div>

            <div
              className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
              role="img"
              aria-label={`Grilla de los últimos ${days.length} días: ${current} días seguidos al día.`}
            >
              {weeks.map((week, w) =>
                week.map((d, i) =>
                  d ? (
                    <span
                      key={d.day}
                      title={`${d.day} · ${DAY_LABEL[d.state]}`}
                      className={cn("size-[9px] rounded-[2px]", DAY_STYLE[d.state])}
                    />
                  ) : (
                    <span key={`${w}-${i}`} className="size-[9px]" aria-hidden />
                  ),
                ),
              )}
          </div>
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
            href="/activity?cat=none"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Ponerte al día: {backlog} sin categoría
          </Link>
        )}
      </div>
    </section>
  );
}

/** Solo lunes, miércoles y viernes: las siete iniciales no entran a 9px, y en
 *  español M y S se repiten. Las filas cambian según dónde empiece la semana. */
const WEEKDAY_LABELS: Record<WeekStart, string[]> = {
  monday: ["L", "", "X", "", "V", "", ""],
  sunday: ["", "L", "", "X", "", "V", ""],
};

const monthFmt = new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", month: "short" });

/** Agrupa los días en columnas de 7 alineadas al lunes, rellenando la primera. */
function toWeeks(days: StreakDay[], weekStart: WeekStart): (StreakDay | null)[][] {
  if (days.length === 0) return [];
  const cells: (StreakDay | null)[] = [
    ...Array<null>(weekdayIndex(days[0].day, weekStart)).fill(null),
    ...days,
  ];
  const weeks: (StreakDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Nombre del mes si esta semana contiene su día 1; si no, nada. */
function monthStart(week: (StreakDay | null)[]): string | null {
  const first = week.find((d) => d?.day.endsWith("-01"));
  return first ? monthFmt.format(new Date(`${first.day}T12:00:00Z`)).replace(".", "") : null;
}

import { shiftDay } from "./format.ts";

/**
 * Racha diaria "estar al día" (SPEC §16.3). Un día cuenta si al cerrarse no quedó
 * ningún gasto suyo sin categorizar; un día sin gastos cuenta solo, porque el
 * usuario igual está al día. Todo se deriva de `expenses`: no hay contador que
 * mantener ni que pueda desfasarse del dato real.
 */

/** Gasto reducido a lo que la racha necesita, ya en días civiles de Lima. */
export type StreakExpense = {
  /** Día en que ocurrió, "YYYY-MM-DD" en horario de Lima. */
  day: string;
  /** Día en que entró a la base, "YYYY-MM-DD" en horario de Lima. */
  importedDay: string;
  categorized: boolean;
};

export type DayState =
  /** Hubo gastos y quedaron todos categorizados. */
  | "clean"
  /** No hubo gastos: el día cuenta igual. */
  | "quiet"
  /** Quedó algo sin categorizar, pero una congelada cubrió el día. */
  | "frozen"
  /** Quedó algo sin categorizar y rompió la racha. */
  | "missed"
  /** Hoy, todavía abierto, con algo sin categorizar. */
  | "pending";

export type StreakDay = { day: string; state: DayState };

export type Streak = {
  /** Días seguidos al día, contando hoy solo si ya está limpio. */
  current: number;
  longest: number;
  /** Congeladas disponibles (0-2). */
  freezes: number;
  /** Hoy tiene gastos sin categorizar: la racha está en riesgo, no rota. */
  atRisk: boolean;
  /** Gastos sin categorizar de días ya cerrados. Viven fuera de la racha. */
  backlog: number;
  /** Último tramo de días para la grilla, del más viejo al más nuevo. */
  days: StreakDay[];
};

/** Hitos que disparan tarjeta compartible. El de 7 es el que más pesa. */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;
/** Rachas a las que se regala una congelada. */
const FREEZE_AWARDS = [7, 30];
const MAX_FREEZES = 2;
/** Días que entran en la grilla. */
const GRID_DAYS = 364;

/**
 * Un gasto importado después del cierre de su día no ensucia ese día: el sync
 * puede traer el correo del banco con retraso y el usuario no controla eso
 * (SPEC §16.3). Se da un día de gracia sobre el día del gasto.
 */
function breaksItsDay(expense: StreakExpense): boolean {
  if (expense.categorized) return false;
  return expense.importedDay <= shiftDay(expense.day, { days: -1 });
}

export function computeStreak(expenses: StreakExpense[], today: string): Streak {
  const empty: Streak = {
    current: 0,
    longest: 0,
    freezes: 0,
    atRisk: false,
    backlog: 0,
    days: [],
  };
  if (expenses.length === 0) return empty;

  const dirty = new Set<string>();
  const active = new Set<string>();
  let backlog = 0;
  let firstDay = today;

  for (const expense of expenses) {
    if (expense.day > today) continue; // gasto futuro: no juega
    active.add(expense.day);
    if (expense.day < firstDay) firstDay = expense.day;
    if (breaksItsDay(expense)) dirty.add(expense.day);
    if (!expense.categorized && expense.day < today) backlog += 1;
  }

  const days: StreakDay[] = [];
  let current = 0;
  let longest = 0;
  let freezes = 0;

  // Hoy sigue abierto: se evalúa aparte para no romper una racha que el usuario
  // todavía puede salvar antes de que termine el día.
  for (let day = firstDay; day < today; day = shiftDay(day, { days: -1 })) {
    if (dirty.has(day)) {
      if (freezes > 0) {
        freezes -= 1;
        current += 1;
        days.push({ day, state: "frozen" });
      } else {
        current = 0;
        freezes = 0;
        days.push({ day, state: "missed" });
      }
    } else {
      current += 1;
      days.push({ day, state: active.has(day) ? "clean" : "quiet" });
    }
    if (FREEZE_AWARDS.includes(current)) freezes = Math.min(MAX_FREEZES, freezes + 1);
    if (current > longest) longest = current;
  }

  const atRisk = dirty.has(today);
  if (atRisk) {
    days.push({ day: today, state: "pending" });
  } else {
    current += 1;
    days.push({ day: today, state: active.has(today) ? "clean" : "quiet" });
    if (FREEZE_AWARDS.includes(current)) freezes = Math.min(MAX_FREEZES, freezes + 1);
    if (current > longest) longest = current;
  }

  return { current, longest, freezes, atRisk, backlog, days: days.slice(-GRID_DAYS) };
}

/** Días seguidos sin ningún gasto, hasta ayer: hoy todavía puede llegar uno. */
export function noSpendStreak(expenses: StreakExpense[], today: string): number {
  const active = new Set(expenses.map((e) => e.day));
  let count = 0;
  for (let day = shiftDay(today, { days: 1 }); !active.has(day); day = shiftDay(day, { days: 1 })) {
    count += 1;
    if (count > GRID_DAYS) break; // sin gastos en un año: no hay nada que contar
  }
  return count;
}

/** Primer día de la semana del usuario. El default es lunes (ISO 8601). */
export type WeekStart = "monday" | "sunday";

/**
 * Posición del día dentro de la semana, 0 = primera fila de la grilla.
 * `Date.getUTCDay()` numera 0 = domingo, que es la convención estadounidense;
 * con la semana en lunes hay que rotar.
 */
export function weekdayIndex(day: string, weekStart: WeekStart = "monday"): number {
  const sundayFirst = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekStart === "sunday" ? sundayFirst : (sundayFirst + 6) % 7;
}

/** Hito alcanzado exactamente hoy, para ofrecer la tarjeta sin repetirla a diario. */
export function reachedMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m === current) ?? null;
}

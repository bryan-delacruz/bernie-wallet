import { STREAK_MILESTONES, type Streak } from "./streak.ts";

/**
 * Logros alcanzados (SPEC §16.4). Son derivados: no se guardan. Lo único que se
 * recuerda es cuáles ya se celebraron, y eso vive en el navegador — así no hace
 * falta migración ni una tabla que mantener sincronizada.
 */

export type Achievement = {
  /** Estable y único: es la llave con la que el navegador recuerda si ya se celebró. */
  id: string;
  title: string;
  detail: string;
};

/** Hitos de volumen. Celebran la promesa del producto: muchos gastos, cero a mano. */
const EXPENSE_MILESTONES = [100, 500, 1000];

export function achievementsFor({
  streak,
  totalExpenses,
  cleanMonth,
}: {
  streak: Pick<Streak, "current">;
  totalExpenses: number;
  /** Mes ya cerrado y 100% categorizado, como "2026-09". null si no aplica. */
  cleanMonth: string | null;
}): Achievement[] {
  const earned: Achievement[] = [];

  for (const milestone of STREAK_MILESTONES) {
    if (streak.current >= milestone) {
      earned.push({
        id: `streak-${milestone}`,
        title: `${milestone} días al día`,
        detail:
          milestone === 365
            ? "Un año entero sin perderle el rastro a tu plata."
            : "Seguiste al día todos esos días seguidos.",
      });
    }
  }

  for (const milestone of EXPENSE_MILESTONES) {
    if (totalExpenses >= milestone) {
      earned.push({
        id: `expenses-${milestone}`,
        title: `${milestone} gastos anotados`,
        detail: "Y ninguno lo escribiste a mano.",
      });
    }
  }

  if (cleanMonth) {
    earned.push({
      id: `month-${cleanMonth}`,
      title: "Mes 100% categorizado",
      detail: "Cerraste el mes sin dejar un solo gasto suelto.",
    });
  }

  return earned;
}

/** El último logro de la lista es el más reciente: es el que se celebra. */
export function latestAchievement(earned: Achievement[]): Achievement | null {
  return earned.at(-1) ?? null;
}

import { shiftDay } from "./format.ts";

/**
 * Retos de abstinencia (SPEC §16.6.1): no gastar en una categoría durante N días.
 *
 * El progreso es derivado, igual que la racha: lo único guardado es la apuesta. Un
 * gasto de la categoría **no** termina el reto, reinicia el contador al día
 * siguiente — romperlo no castiga, y por eso no existe un estado "roto".
 */

export type ChallengeBet = {
  /** Día de inicio, "YYYY-MM-DD" en horario de Lima. */
  startedOn: string;
  targetDays: number;
};

export type ChallengeProgress = {
  /** Días limpios seguidos hasta hoy, contando hoy. */
  current: number;
  /** Racha limpia más larga desde que empezó el reto. */
  best: number;
  targetDays: number;
  /** Ya alcanzó la meta. */
  done: boolean;
  /** Hubo al menos un reinicio: el usuario gastó en la categoría. */
  restarts: number;
};

/**
 * @param slipDays Días (de Lima) en que hubo un gasto de la categoría del reto,
 *        en cualquier orden.
 */
export function challengeProgress(
  bet: ChallengeBet,
  slipDays: string[],
  today: string,
): ChallengeProgress {
  // Solo cuentan los tropiezos dentro de la ventana del reto.
  const slips = [...new Set(slipDays)]
    .filter((day) => day >= bet.startedOn && day <= today)
    .sort();

  // El tramo en curso arranca el día después del último tropiezo.
  const lastSlip = slips.at(-1);
  const runStart = lastSlip ? shiftDay(lastSlip, { days: -1 }) : bet.startedOn;
  const current = Math.max(0, daysBetween(runStart, today) + 1);

  // El mejor intento: el tramo limpio más largo entre tropiezos.
  let best = current;
  let segmentStart = bet.startedOn;
  for (const slip of slips) {
    best = Math.max(best, daysBetween(segmentStart, slip));
    segmentStart = shiftDay(slip, { days: -1 });
  }

  return {
    current,
    best,
    targetDays: bet.targetDays,
    done: current >= bet.targetDays,
    restarts: slips.length,
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Cuándo mostrar el aviso de "ordenar pendientes" en Actividad. Puro, sin IO.
 *
 * El aviso puede descartarse. Lo que decide que vuelva no es el reloj sino el
 * backlog: vuelve cuando se acumularon bastantes pendientes nuevos desde el
 * descarte, porque recién ahí tiene una noticia que dar. Un aviso que reaparece
 * sin novedad es la misma molestia que el usuario ya rechazó una vez.
 */

/** Pendientes a partir de los cuales el lote rinde. Por debajo se editan más
 *  rápido uno a uno desde la propia lista de Actividad. */
export const BULK_THRESHOLD = 3;

/** Cuántos pendientes nuevos justifican volver a avisar después de un descarte. */
export const HINT_REGROWTH = 20;

/** Tope de seguridad para quien descartó y nunca volvió a juntar `HINT_REGROWTH`. */
export const HINT_MAX_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type HintState = {
  pendingExpenses: number;
  enabled: boolean;
  dismissedAt: string | null;
  /** Pendientes que había al momento del descarte. */
  pendingAtDismiss: number | null;
};

export type Hint =
  | { show: false }
  /** `since` son los pendientes nuevos desde el descarte; 0 si nunca descartó. */
  | { show: true; pendingExpenses: number; since: number };

export function categorizeHint(state: HintState, now: Date = new Date()): Hint {
  const { pendingExpenses, enabled, dismissedAt, pendingAtDismiss } = state;

  if (!enabled) return { show: false };
  if (pendingExpenses < BULK_THRESHOLD) return { show: false };
  if (!dismissedAt) return { show: true, pendingExpenses, since: 0 };

  // Un backlog que bajó desde el descarte no es novedad: el usuario está ordenando.
  const since = Math.max(0, pendingExpenses - (pendingAtDismiss ?? 0));
  const days = (now.getTime() - new Date(dismissedAt).getTime()) / DAY_MS;

  if (since >= HINT_REGROWTH) return { show: true, pendingExpenses, since };
  if (days >= HINT_MAX_DAYS) return { show: true, pendingExpenses, since };
  return { show: false };
}

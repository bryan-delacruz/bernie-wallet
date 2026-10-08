/**
 * Memoria y agrupación por comercio: funciones **puras**, sin IO ni IA.
 *
 * Viven aparte del sync porque las usan dos lugares (el pipeline de
 * `lib/sync/run-sync.ts` y la cola de `/categorize`) y tienen que coincidir: si la
 * app sugiriera en `/categorize` algo distinto de lo que el sync asigna, el usuario
 * vería dos criterios para "el mismo comercio". Una sola definición evita eso.
 */

/** Tope de la memoria por comercio: solo los N gastos categorizados más recientes
 *  (evita escanear un historial enorme; prioriza las categorizaciones recientes). */
export const MERCHANT_MEMORY_LIMIT = 2000;

/** Normaliza el comercio para agrupar variantes del mismo (mayúsculas, espacios). */
export function normMerchant(m: string): string {
  return m.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Fila mínima para construir la memoria: lo que el gasto ya categorizado aporta. */
export type MemoryRow = { merchant: string | null; subcategory_id: string | null };

/** Acuerdo mínimo del historial para que la memoria hable. Por debajo, el comercio
 *  se usó para cosas distintas y la subcategoría más frecuente no es una respuesta,
 *  es un empate con suerte. */
export const MIN_AGREEMENT = 0.7;
/** Antecedentes mínimos. Con uno solo no hay acuerdo que medir: una categorización
 *  suelta no puede decidir todo lo que venga después de ese comercio. */
export const MIN_SAMPLES = 2;

export type MerchantMemoryEntry = {
  /** La subcategoría más frecuente del comercio. */
  subcategoryId: string;
  /** Veces que ganó, sobre el total de gastos categorizados del comercio. */
  count: number;
  total: number;
  /** `count / total`. 1 es un historial unánime. */
  agreement: number;
  /** Todas las subcategorías del comercio, de más a menos frecuente. Sirve para
   *  explicar en qué varía, no para elegir. */
  ranked: string[];
};

export type MerchantMemory = Map<string, MerchantMemoryEntry>;

/**
 * Memoria por comercio a partir de gastos ya categorizados.
 *
 * Devuelve el acuerdo además de la moda: quien consulta decide si eso alcanza. Un
 * comercio con 9 de 10 "Alquiler" y otro con 5 y 5 tienen la misma moda y no
 * merecen la misma confianza.
 *
 * Empate: gana la primera que llegó. El llamador ordena por fecha descendente, así
 * que "la primera" es la más reciente — el desempate favorece lo último que el
 * usuario decidió.
 */
export function tallyMerchantMemory(rows: MemoryRow[]): MerchantMemory {
  const counts = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (!row.subcategory_id || !row.merchant) continue;
    const key = normMerchant(row.merchant);
    const inner = counts.get(key) ?? new Map<string, number>();
    inner.set(row.subcategory_id, (inner.get(row.subcategory_id) ?? 0) + 1);
    counts.set(key, inner);
  }

  const memory: MerchantMemory = new Map();
  for (const [key, inner] of counts) {
    const ranked = [...inner.entries()].sort((a, b) => b[1] - a[1]);
    const [subcategoryId, count] = ranked[0];
    const total = ranked.reduce((acc, [, n]) => acc + n, 0);
    memory.set(key, {
      subcategoryId,
      count,
      total,
      agreement: count / total,
      ranked: ranked.map(([id]) => id),
    });
  }
  return memory;
}

/**
 * Reglas del usuario: `comercio normalizado → subcategoría fija`, o `null` para
 * "no generalizar este comercio". Manda sobre la memoria: lo que el usuario declara
 * le gana a lo que la app aprendió.
 */
export type MerchantRules = Map<string, string | null>;

export type Suggestion =
  /** Sin historial: no hay nada que sugerir. */
  | { kind: "none" }
  /** El usuario pidió no generalizar este comercio. */
  | { kind: "muted" }
  /** Hay historial, pero se contradice. `options` va de más a menos frecuente. */
  | { kind: "varies"; options: string[] }
  | { kind: "memory"; subcategoryId: string; agreement: number }
  /** Regla del usuario con subcategoría fija. */
  | { kind: "pinned"; subcategoryId: string };

/** Qué decir sobre un comercio. Único lugar donde se cruzan reglas y memoria. */
export function suggestFor(
  key: string,
  memory: MerchantMemory,
  rules: MerchantRules,
): Suggestion {
  if (rules.has(key)) {
    const pinned = rules.get(key) ?? null;
    return pinned ? { kind: "pinned", subcategoryId: pinned } : { kind: "muted" };
  }

  const entry = memory.get(key);
  if (!entry) return { kind: "none" };

  if (entry.total < MIN_SAMPLES || entry.agreement < MIN_AGREEMENT) {
    return { kind: "varies", options: entry.ranked };
  }
  return { kind: "memory", subcategoryId: entry.subcategoryId, agreement: entry.agreement };
}

/**
 * Subcategoría que el sync puede asignar solo, o `null` para dejar el gasto
 * pendiente. Callarse es la respuesta correcta ante la duda: un gasto sin categoría
 * se ve y se corrige, uno mal categorizado se esconde en el total.
 */
export function autoSubcategory(
  key: string,
  memory: MerchantMemory,
  rules: MerchantRules,
): string | null {
  const suggestion = suggestFor(key, memory, rules);
  return suggestion.kind === "memory" || suggestion.kind === "pinned"
    ? suggestion.subcategoryId
    : null;
}

/** Gasto pendiente tal como lo necesita la cola (nada de medio de pago ni origen). */
export type PendingExpense = {
  id: string;
  merchant: string | null;
  amount: number | string;
  currency: string;
  occurred_at: string;
};

/** Un comercio del backlog, con todo lo que la fila necesita para decidir. */
export type MerchantGroup = {
  /** Comercio normalizado: la clave del grupo y de la memoria. */
  key: string;
  /** Nombre a mostrar: el del gasto más reciente, sin normalizar. */
  label: string;
  /** Todos los gastos del grupo, del más reciente al más viejo. Los ids son lo que
   *  recibe el UPDATE en lote; el resto se muestra cuando el grupo se abre de a uno
   *  (comercio que el usuario pidió no generalizar). */
  expenses: PendingExpense[];
  count: number;
  /** Total por moneda: PEN y USD no se suman entre sí. */
  totals: { currency: string; amount: number }[];
  /** Primer y último día del grupo (ISO), para dar contexto sin abrir nada. */
  firstAt: string;
  lastAt: string;
};

/**
 * Agrupa los gastos sin categoría por comercio normalizado, ordenados por cantidad
 * (y a igual cantidad, por total descendente): arriba queda lo que más rinde
 * ordenar. Los gastos sin comercio se omiten — no hay nada que agrupar ni aprender.
 */
export function groupUncategorized(rows: PendingExpense[]): MerchantGroup[] {
  type Draft = Omit<MerchantGroup, "totals"> & { totals: Map<string, number> };
  const drafts = new Map<string, Draft>();

  for (const row of rows) {
    const key = normMerchant(row.merchant ?? "");
    if (!key) continue;

    const amount = Number(row.amount) || 0;
    const existing = drafts.get(key);

    if (!existing) {
      drafts.set(key, {
        key,
        label: (row.merchant ?? "").trim(),
        expenses: [row],
        count: 1,
        totals: new Map([[row.currency, amount]]),
        firstAt: row.occurred_at,
        lastAt: row.occurred_at,
      });
      continue;
    }

    existing.expenses.push(row);
    existing.count += 1;
    existing.totals.set(row.currency, (existing.totals.get(row.currency) ?? 0) + amount);
    if (row.occurred_at < existing.firstAt) existing.firstAt = row.occurred_at;
    if (row.occurred_at > existing.lastAt) {
      existing.lastAt = row.occurred_at;
      // El nombre visible sigue al gasto más reciente: si el banco cambió la
      // grafía del comercio, se muestra la última.
      existing.label = (row.merchant ?? "").trim();
    }
  }

  return [...drafts.values()]
    .map((d) => ({
      ...d,
      expenses: d.expenses.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
      totals: [...d.totals.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.count - a.count || sumTotals(b) - sumTotals(a) || a.key.localeCompare(b.key));
}

/** Suma cruda de los totales, **solo** para desempatar el orden de la lista.
 *  No se muestra: sumar PEN y USD no tiene sentido como cifra. */
function sumTotals(group: { totals: { amount: number }[] }): number {
  return group.totals.reduce((acc, t) => acc + t.amount, 0);
}

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

/**
 * Memoria por comercio a partir de gastos ya categorizados:
 * `merchant normalizado → subcategoría más frecuente`.
 *
 * Empate: gana la primera que llegó. El llamador ordena por fecha descendente, así
 * que "la primera" es la más reciente — el desempate favorece lo último que el
 * usuario decidió.
 */
export function tallyMerchantMemory(rows: MemoryRow[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (!row.subcategory_id || !row.merchant) continue;
    const key = normMerchant(row.merchant);
    const inner = counts.get(key) ?? new Map<string, number>();
    inner.set(row.subcategory_id, (inner.get(row.subcategory_id) ?? 0) + 1);
    counts.set(key, inner);
  }

  const memory = new Map<string, string>();
  for (const [key, inner] of counts) {
    let best = "";
    let bestN = 0;
    for (const [sub, n] of inner) {
      if (n > bestN) {
        bestN = n;
        best = sub;
      }
    }
    if (best) memory.set(key, best);
  }
  return memory;
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
  /** Ids de **todos** los gastos del grupo: lo que recibe el UPDATE en lote. */
  expenseIds: string[];
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
        expenseIds: [row.id],
        count: 1,
        totals: new Map([[row.currency, amount]]),
        firstAt: row.occurred_at,
        lastAt: row.occurred_at,
      });
      continue;
    }

    existing.expenseIds.push(row.id);
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

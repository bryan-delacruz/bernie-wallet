import { encodeCursor, type SyncCursor } from "./cursor.ts";

/** Fila de shared_expense_changes() (migración 0009). */
export type ChangeRow = {
  id: string;
  removed: boolean;
  occurred_at: string | null;
  amount: string | null;
  currency: string | null;
  merchant: string | null;
  subcategory: string | null;
  created_at: string | null;
  changed_at: string;
};

export type SharedExpense = {
  id: string;
  occurredAt: string;
  amount: string;
  currency: string;
  merchant: string;
  subcategory: string | null;
};

export type SyncPage = {
  added: SharedExpense[];
  modified: SharedExpense[];
  removed: string[];
  nextCursor: string;
  hasMore: boolean;
};

const toIso = (value: string) => new Date(value).toISOString();

/**
 * Arma una página del contrato a partir de `limit + 1` filas ordenadas.
 * - Sin cursor previo todo es `added`.
 * - Con cursor, es `added` lo creado después del cursor; lo demás, `modified`.
 *   La ventana de relectura puede repetir gastos ya enviados: el cliente es
 *   idempotente, así que repetirlos como `modified` es seguro.
 */
export function buildSyncPage(
  rows: ChangeRow[],
  opts: { limit: number; previous: SyncCursor | null; sharesVersion: number; now: Date },
): SyncPage {
  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  const since = opts.previous ? Date.parse(opts.previous.ts) : null;

  const added: SharedExpense[] = [];
  const modified: SharedExpense[] = [];
  const removed: string[] = [];

  for (const row of page) {
    if (row.removed) {
      removed.push(row.id);
      continue;
    }
    const expense: SharedExpense = {
      id: row.id,
      occurredAt: toIso(row.occurred_at!),
      amount: row.amount!,
      currency: row.currency!,
      merchant: row.merchant!,
      subcategory: row.subcategory,
    };
    const isNew = since === null || Date.parse(row.created_at!) > since;
    (isNew ? added : modified).push(expense);
  }

  const last = page.at(-1);
  // El ts del cursor va tal cual lo entrega Postgres (con microsegundos). Pasarlo
  // por Date lo truncaría a milisegundos: con más de `limit` filas en el mismo
  // instante (p. ej. mover una subcategoría toca todos sus gastos en una sola
  // sentencia), la página siguiente repetiría las mismas filas para siempre.
  const cursor: SyncCursor = last
    ? { ts: last.changed_at, id: last.id, sv: opts.sharesVersion, final: !hasMore }
    : opts.previous
      ? { ...opts.previous, sv: opts.sharesVersion, final: true }
      : // Sync inicial vacía: se empieza desde ahora; la ventana de relectura cubre
        // la diferencia de reloj entre el servidor y la base.
        { ts: opts.now.toISOString(), id: "00000000-0000-0000-0000-000000000000", sv: opts.sharesVersion, final: true };

  return { added, modified, removed, nextCursor: encodeCursor(cursor), hasMore };
}

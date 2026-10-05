/**
 * Alturas del desglose por categoría. Viven aparte de `category-bars.tsx` porque
 * la página (Server Component) necesita la misma fórmula para reservar el espacio
 * antes de que cargue Recharts: el gráfico llega por import dinámico y su alto
 * depende del número de filas, así que un placeholder de alto fijo movería el
 * contenido al hidratar.
 */

/** Categorías que se pintan antes de agrupar el resto en una sola barra. */
export const CATEGORY_TOP_N = 5;

/** Filas visibles mientras el desglose está colapsado: el top N más la barra
 *  agrupada. Agrupar una sola categoría no ahorra nada, así que con 6 se pintan
 *  las 6. */
export function collapsedRowCount(total: number): number {
  return total > CATEGORY_TOP_N + 1 ? CATEGORY_TOP_N + 1 : total;
}

/** Alto del gráfico: ~34px por fila, con mínimo. El tope solo aplica colapsado;
 *  expandido las filas mandan, si no 13 categorías entran apelmazadas. */
export function categoryChartHeight(rows: number, capped = true): number {
  const height = Math.max(96, rows * 34 + 28);
  return capped ? Math.min(260, height) : height;
}

/** Alto del bloque completo, incluido el selector de orden que solo aparece con
 *  dos o más filas (alto del control + el gap de `space-y-3`). */
export function categoryBlockHeight(rows: number): number {
  return categoryChartHeight(rows) + (rows > 1 ? 40 : 0);
}

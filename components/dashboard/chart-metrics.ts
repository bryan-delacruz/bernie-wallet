/**
 * Alturas del desglose por categoría. Viven aparte de `category-bars.tsx` porque
 * la página (Server Component) necesita la misma fórmula para reservar el espacio
 * antes de que cargue Recharts: el gráfico llega por import dinámico y su alto
 * depende del número de filas, así que un placeholder de alto fijo movería el
 * contenido al hidratar.
 */

/** Alto del gráfico: ~34px por fila, con mínimo y máximo. */
export function categoryChartHeight(rows: number): number {
  return Math.min(260, Math.max(96, rows * 34 + 28));
}

/** Alto del bloque completo, incluido el selector de orden que solo aparece con
 *  dos o más filas (alto del control + el gap de `space-y-3`). */
export function categoryBlockHeight(rows: number): number {
  return categoryChartHeight(rows) + (rows > 1 ? 40 : 0);
}

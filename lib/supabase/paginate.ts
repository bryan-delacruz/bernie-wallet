/** Tamaño de página: coincide con `max_rows` de la API de Supabase
 *  (`supabase/config.toml`), que es el techo que el servidor aplica por request. */
const PAGE_SIZE = 1000;
/** Techo defensivo: evita un bucle infinito si el servidor devolviera páginas llenas
 *  indefinidamente. 24 páginas ≈ 24k gastos, muy por encima del uso real. */
const MAX_PAGES = 24;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Trae todas las filas de una consulta paginando con `range`.
 *
 * La API de Supabase corta en `max_rows` (1000) **sin avisar**: una consulta sin
 * paginar simplemente devuelve menos filas de las que existen, y los totales salen
 * mal sin ningún error. Por eso el llamador pasa una *fábrica* de consultas —cada
 * página necesita su propia query— en vez de una query ya construida.
 *
 * Devuelve `truncated: true` si se alcanzó `MAX_PAGES`, para que el llamador decida
 * si degradar la vista o registrar el caso.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[paginate] página", page, "falló:", error.message);
      return { rows, truncated: true };
    }
    if (!data?.length) return { rows, truncated: false };

    rows.push(...data);
    // Página incompleta = última página.
    if (data.length < PAGE_SIZE) return { rows, truncated: false };
  }

  console.warn("[paginate] se alcanzó MAX_PAGES; el resultado está incompleto");
  return { rows, truncated: true };
}

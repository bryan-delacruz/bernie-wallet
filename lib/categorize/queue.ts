import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import {
  MERCHANT_MEMORY_LIMIT,
  groupUncategorized,
  tallyMerchantMemory,
  type MerchantGroup,
  type PendingExpense,
} from "@/lib/categorize/merchant";

export type SuggestedGroup = MerchantGroup & {
  /** Subcategoría que el sync asignaría a este comercio, si ya aprendió de él. */
  suggestedSubcategoryId: string | null;
};

export type CategorizationQueue = {
  groups: SuggestedGroup[];
  /** Gastos pendientes contados en los grupos. */
  pendingExpenses: number;
  /** Pendientes sin comercio: no se pueden agrupar, se resuelven uno a uno. */
  withoutMerchant: number;
  /** La lectura alcanzó el techo de páginas: la cola está incompleta. */
  truncated: boolean;
};

/**
 * Cola de categorización del usuario: gastos sin subcategoría agrupados por
 * comercio, con la sugerencia de la memoria del sync.
 *
 * Pagina la lectura: el backlog puede pasar las 1000 filas que la API de Supabase
 * corta en silencio. Memoizada por request (`cache`) porque la página y su
 * encabezado la necesitan por separado.
 */
export const loadCategorizationQueue = cache(
  async (userId: string): Promise<CategorizationQueue> => {
    const supabase = await createClient();

    const [pending, memoryRows] = await Promise.all([
      fetchAllRows<PendingExpense>((from, to) =>
        supabase
          .from("expenses")
          .select("id, merchant, amount, currency, occurred_at")
          .eq("user_id", userId)
          .is("subcategory_id", null)
          .order("occurred_at", { ascending: false })
          .range(from, to),
      ),
      supabase
        .from("expenses")
        .select("merchant, subcategory_id")
        .eq("user_id", userId)
        .not("subcategory_id", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(MERCHANT_MEMORY_LIMIT),
    ]);

    const memory = tallyMerchantMemory(memoryRows.data ?? []);
    const groups = groupUncategorized(pending.rows).map((group) => ({
      ...group,
      suggestedSubcategoryId: memory.get(group.key) ?? null,
    }));

    const grouped = groups.reduce((acc, g) => acc + g.count, 0);

    return {
      groups,
      pendingExpenses: grouped,
      withoutMerchant: pending.rows.length - grouped,
      truncated: pending.truncated,
    };
  },
);

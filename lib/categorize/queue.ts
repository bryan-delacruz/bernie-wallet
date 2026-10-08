import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import {
  MERCHANT_MEMORY_LIMIT,
  groupUncategorized,
  suggestFor,
  tallyMerchantMemory,
  type MerchantGroup,
  type MerchantRules,
  type PendingExpense,
  type Suggestion,
} from "@/lib/categorize/merchant";

export type SuggestedGroup = MerchantGroup & {
  /** Qué decir sobre este comercio: la sugerencia, "varía", o "no agrupar". */
  suggestion: Suggestion;
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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Reglas del usuario, listas para consultar por comercio normalizado. */
export async function loadMerchantRules(
  supabase: SupabaseClient,
  userId: string,
): Promise<MerchantRules> {
  const { data } = await supabase
    .from("merchant_rules")
    .select("merchant_key, subcategory_id")
    .eq("user_id", userId);

  return new Map((data ?? []).map((r) => [r.merchant_key, r.subcategory_id]));
}

/**
 * Cola de categorización del usuario: gastos sin subcategoría agrupados por
 * comercio, con lo que la app puede decir de cada uno.
 *
 * Pagina la lectura: el backlog puede pasar las 1000 filas que la API de Supabase
 * corta en silencio. Memoizada por request (`cache`).
 */
export const loadCategorizationQueue = cache(
  async (userId: string): Promise<CategorizationQueue> => {
    const supabase = await createClient();

    const [pending, memoryRows, rules] = await Promise.all([
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
      loadMerchantRules(supabase, userId),
    ]);

    const memory = tallyMerchantMemory(memoryRows.data ?? []);
    const groups = groupUncategorized(pending.rows).map((group) => ({
      ...group,
      suggestion: suggestFor(group.key, memory, rules),
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

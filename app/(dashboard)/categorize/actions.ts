"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTaxonomy, type Taxonomy } from "@/lib/taxonomy";
import { scheduleWebhookDelivery } from "@/lib/integrations/webhook-delivery";
import { loadCategorizationQueue } from "@/lib/categorize/queue";

export type BulkResult = { updated?: number; error?: string };

/** Tope de ids por acción: un comercio con más gastos que esto no existe en la
 *  práctica, y acota lo que un cliente puede mandar de una vez. */
const MAX_IDS = 5000;
/** Ids por `UPDATE`: evita armar una URL enorme en el `in(...)`. */
const CHUNK = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function refresh(taxonomyChanged: boolean) {
  revalidatePath("/categorize");
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  if (taxonomyChanged) revalidatePath("/categories");
  scheduleWebhookDelivery();
}

/**
 * Asigna `subcategoryId` a los gastos indicados, en lotes.
 *
 * Dos filtros además de la RLS: `user_id` (red ante un id ajeno) y
 * `subcategory_id is null` (solo toca lo que sigue pendiente, así una pestaña
 * vieja no puede sobrescribir una categorización ya hecha).
 */
async function assignInBatches(
  supabase: SupabaseClient,
  userId: string,
  expenseIds: string[],
  subcategoryId: string,
): Promise<{ updated: number } | { error: string }> {
  let updated = 0;

  for (let i = 0; i < expenseIds.length; i += CHUNK) {
    const chunk = expenseIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("expenses")
      .update({ subcategory_id: subcategoryId })
      .in("id", chunk)
      .eq("user_id", userId)
      .is("subcategory_id", null)
      .select("id");

    if (error) return { error: "No se pudieron guardar los gastos." };
    updated += data?.length ?? 0;
  }

  return { updated };
}

/** Categoriza de una vez todos los gastos de un comercio. */
export async function categorizeBulk(
  expenseIds: string[],
  taxonomy: Taxonomy,
): Promise<BulkResult> {
  const ids = [...new Set(expenseIds)].filter((id) => UUID.test(id));
  if (!ids.length) return { error: "No hay gastos que categorizar." };
  if (ids.length > MAX_IDS) return { error: "Demasiados gastos en una sola acción." };

  const { supabase, userId } = await requireUser();

  const resolved = await resolveTaxonomy(supabase, userId, taxonomy);
  if ("error" in resolved) return resolved;
  if (!resolved.subcategoryId) {
    return { error: "Elige una subcategoría para aplicarla al grupo." };
  }

  const result = await assignInBatches(supabase, userId, ids, resolved.subcategoryId);
  if ("error" in result) return result;

  refresh(resolved.created);
  return { updated: result.updated };
}

/**
 * Aplica las sugerencias pendientes de toda la cola.
 *
 * Recalcula la cola en el servidor en vez de confiar en lo que mande el cliente:
 * lo que se guarda es exactamente lo que la memoria del sync sugiere ahora.
 */
export async function applyAllSuggestions(): Promise<BulkResult> {
  const { supabase, userId } = await requireUser();
  const { groups } = await loadCategorizationQueue(userId);

  let updated = 0;
  for (const group of groups) {
    if (!group.suggestedSubcategoryId) continue;
    const result = await assignInBatches(
      supabase,
      userId,
      group.expenseIds,
      group.suggestedSubcategoryId,
    );
    if ("error" in result) return result;
    updated += result.updated;
  }

  if (!updated) return { error: "No hay sugerencias por aplicar." };

  refresh(false);
  return { updated };
}

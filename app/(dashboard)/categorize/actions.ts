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
    return { error: "Elige una categoría para aplicarla al grupo." };
  }

  const result = await assignInBatches(supabase, userId, ids, resolved.subcategoryId);
  if ("error" in result) return result;

  refresh(resolved.created);
  return { updated: result.updated };
}

/**
 * Aplica las sugerencias pendientes de la cola, de los grupos con al menos
 * `minGroupSize` gastos.
 *
 * Recalcula la cola en el servidor en vez de confiar en lo que mande el cliente:
 * lo que se guarda es exactamente lo que la memoria del sync sugiere ahora.
 */
export async function applyAllSuggestions(minGroupSize = 1): Promise<BulkResult> {
  const { supabase, userId } = await requireUser();
  const { groups } = await loadCategorizationQueue(userId);

  // El mismo filtro que la pantalla: se aplica lo que el usuario está viendo, no
  // lo que quedó escondido detrás del filtro.
  const min = Number.isFinite(minGroupSize) ? Math.max(1, Math.trunc(minGroupSize)) : 1;

  let updated = 0;
  for (const group of groups) {
    if (group.count < min) continue;
    // Solo lo que la app puede afirmar: "varía" y "no agrupar" se quedan afuera.
    if (group.suggestion.kind !== "memory" && group.suggestion.kind !== "pinned") continue;
    const result = await assignInBatches(
      supabase,
      userId,
      group.expenses.map((e) => e.id),
      group.suggestion.subcategoryId,
    );
    if ("error" in result) return result;
    updated += result.updated;
  }

  if (!updated) return { error: "No hay sugerencias por aplicar." };

  refresh(false);
  return { updated };
}

/**
 * Marca o desmarca un comercio como "no generalizar".
 *
 * La regla la declara el usuario y le gana a la memoria: a partir de acá el sync
 * deja de autocategorizar ese comercio y la cola deja de ofrecer un solo botón para
 * todo el grupo. Desmarcar borra la fila y devuelve el comercio a la memoria.
 */
export async function setMerchantMuted(
  merchantKey: string,
  muted: boolean,
): Promise<{ error?: string }> {
  const key = merchantKey.trim().slice(0, 200);
  if (!key) return { error: "Comercio inválido." };

  const { supabase, userId } = await requireUser();

  const { error } = muted
    ? await supabase
        .from("merchant_rules")
        .upsert(
          { user_id: userId, merchant_key: key, subcategory_id: null },
          { onConflict: "user_id,merchant_key" },
        )
    : await supabase
        .from("merchant_rules")
        .delete()
        .eq("user_id", userId)
        .eq("merchant_key", key);

  if (error) return { error: "No se pudo guardar la regla." };

  refresh(false);
  return {};
}

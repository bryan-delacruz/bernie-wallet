import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Tope de nombre de categoría/subcategoría, igual que en el combobox. */
const MAX_NAME_LENGTH = 40;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/** Lo que el formulario manda: un id existente, o un nombre por crear. */
export type Taxonomy = {
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Subcategoría implícita cuando el usuario elige categoría y nada más.
 *
 * El gasto cuelga de `subcategory_id`, no de la categoría: sin hoja, elegir
 * "Salud" guardaba el gasto **sin categorizar** y sin avisar. Es el patrón de YNAB
 * y Monarch —la hoja es el destino, el nivel de arriba agrupa— pero ellos lo
 * resuelven bloqueando el guardado. Acá se crea la hoja al paso, igual que ya se
 * crean categorías y subcategorías nuevas: anotar rápido sigue siendo posible y
 * nada se pierde en silencio.
 */
export const GENERAL_SUBCATEGORY = "General";

/**
 * Resuelve la categoría y subcategoría del formulario y crea las que falten
 * (creación al paso desde Activity). Compara los nombres en memoria y sin
 * distinguir mayúsculas: son pocas filas y evita los comodines de `ilike`.
 *
 * Devuelve el `subcategory_id` final del gasto. Es `null` solo si el usuario no
 * eligió categoría: ahí el gasto queda pendiente a propósito, y aparece en la cola
 * de `/categorize`.
 */
export async function resolveTaxonomy(
  supabase: SupabaseClient,
  userId: string,
  taxonomy: Taxonomy,
): Promise<{ subcategoryId: string | null; created: boolean } | { error: string }> {
  const categoryName = taxonomy.categoryName?.trim().slice(0, MAX_NAME_LENGTH) ?? "";
  const subcategoryName = taxonomy.subcategoryName?.trim().slice(0, MAX_NAME_LENGTH) ?? "";

  let created = false;
  let categoryId = taxonomy.categoryId;

  if (categoryName) {
    const { data: existing, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", userId);
    if (error) return { error: "No se pudieron leer tus categorías." };

    const match = (existing ?? []).find((c) => normalize(c.name) === normalize(categoryName));
    if (match) {
      categoryId = match.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("categories")
        .insert({ user_id: userId, name: categoryName })
        .select("id")
        .single();
      if (insertError || !inserted) return { error: "No se pudo crear la categoría." };
      categoryId = inserted.id;
      created = true;
    }
  }

  // Subcategoría existente elegida a mano: nada que resolver.
  if (!subcategoryName && taxonomy.subcategoryId) {
    return { subcategoryId: taxonomy.subcategoryId, created };
  }

  // Sin categoría tampoco: el gasto queda pendiente, a propósito.
  if (!categoryId) {
    if (subcategoryName) {
      return { error: "Elige o crea una categoría para la subcategoría nueva." };
    }
    return { subcategoryId: null, created };
  }

  // Categoría sin subcategoría → la hoja implícita.
  const wanted = subcategoryName || GENERAL_SUBCATEGORY;

  const { data: siblings, error: siblingsError } = await supabase
    .from("subcategories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("category_id", categoryId);
  if (siblingsError) return { error: "No se pudieron leer tus subcategorías." };

  const match = (siblings ?? []).find((s) => normalize(s.name) === normalize(wanted));
  if (match) return { subcategoryId: match.id, created };

  const { data: inserted, error: insertError } = await supabase
    .from("subcategories")
    .insert({ user_id: userId, category_id: categoryId, name: wanted })
    .select("id")
    .single();
  if (insertError || !inserted) return { error: "No se pudo crear la subcategoría." };

  return { subcategoryId: inserted.id, created: true };
}

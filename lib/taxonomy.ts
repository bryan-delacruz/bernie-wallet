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
 * Resuelve la categoría y subcategoría del formulario y crea las que falten
 * (creación al paso desde Activity). Compara los nombres en memoria y sin
 * distinguir mayúsculas: son pocas filas y evita los comodines de `ilike`.
 *
 * Devuelve el `subcategory_id` final del gasto, o `null` si no corresponde
 * (categoría sin subcategoría, igual que al elegir solo categoría).
 */
export async function resolveTaxonomy(
  supabase: SupabaseClient,
  userId: string,
  taxonomy: Taxonomy,
): Promise<{ subcategoryId: string | null; created: boolean } | { error: string }> {
  const categoryName = taxonomy.categoryName?.trim().slice(0, MAX_NAME_LENGTH) ?? "";
  const subcategoryName = taxonomy.subcategoryName?.trim().slice(0, MAX_NAME_LENGTH) ?? "";

  if (!categoryName && !subcategoryName) {
    return { subcategoryId: taxonomy.subcategoryId, created: false };
  }

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

  if (!subcategoryName) return { subcategoryId: taxonomy.subcategoryId, created };

  if (!categoryId) {
    return { error: "Elige o crea una categoría para la subcategoría nueva." };
  }

  const { data: siblings, error: siblingsError } = await supabase
    .from("subcategories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("category_id", categoryId);
  if (siblingsError) return { error: "No se pudieron leer tus subcategorías." };

  const match = (siblings ?? []).find((s) => normalize(s.name) === normalize(subcategoryName));
  if (match) return { subcategoryId: match.id, created };

  const { data: inserted, error: insertError } = await supabase
    .from("subcategories")
    .insert({ user_id: userId, category_id: categoryId, name: subcategoryName })
    .select("id")
    .single();
  if (insertError || !inserted) return { error: "No se pudo crear la subcategoría." };

  return { subcategoryId: inserted.id, created: true };
}


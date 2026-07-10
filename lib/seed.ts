import type { SupabaseClient } from "@supabase/supabase-js";

/** Categorías y subcategorías por defecto (contenido visible al usuario, en español). */
export const DEFAULT_CATEGORIES: { name: string; subcategories: string[] }[] = [
  { name: "Vivienda", subcategories: ["Alquiler", "Internet", "Luz", "Agua", "Gas"] },
  {
    name: "Transporte",
    subcategories: ["Estacionamiento", "Taxi / Uber", "Combustible", "Transporte público"],
  },
  { name: "Alimentación", subcategories: ["Restaurantes", "Supermercado", "Delivery"] },
  { name: "Salud", subcategories: [] },
  { name: "Entretenimiento", subcategories: [] },
  { name: "Transferencias", subcategories: ["Persona a persona", "Pago a terceros"] },
  { name: "Otros", subcategories: [] },
];

/**
 * Siembra las categorías por defecto para un usuario nuevo. Idempotente:
 * si el usuario ya tiene categorías, no hace nada.
 */
export async function seedDefaultCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) return;

  for (const category of DEFAULT_CATEGORIES) {
    const { data: inserted } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: category.name })
      .select("id")
      .single();

    if (inserted && category.subcategories.length > 0) {
      await supabase.from("subcategories").insert(
        category.subcategories.map((name) => ({
          user_id: userId,
          category_id: inserted.id,
          name,
        })),
      );
    }
  }
}

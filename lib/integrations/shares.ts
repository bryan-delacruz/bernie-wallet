import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCategorySelection(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= 50 &&
    ids.every((id) => typeof id === "string" && UUID.test(id))
  );
}

/**
 * Deja compartidas con la app exactamente estas categorías (SPEC §15.4) y lo
 * anota en la auditoría. Corre con la sesión del usuario: RLS impide tocar
 * filas ajenas, y aquí se verifica que las categorías sean suyas (la FK no
 * mira al dueño). Cada cambio sube shares_version por trigger → cursor_reset.
 */
export async function replaceShares(
  supabase: SupabaseClient,
  userId: string,
  clientId: string,
  categoryIds: string[],
  action: "granted" | "shares_changed",
): Promise<{ error?: string }> {
  const unique = [...new Set(categoryIds)];
  const { data: owned } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", unique);
  if (!owned || owned.length !== unique.length) return { error: "invalid_categories" };

  const { error: deleteError } = await supabase
    .from("integration_shares")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .not("category_id", "in", `(${unique.join(",")})`);
  const { error: insertError } = await supabase.from("integration_shares").upsert(
    unique.map((category_id) => ({ user_id: userId, client_id: clientId, category_id })),
    { onConflict: "user_id,client_id,category_id", ignoreDuplicates: true },
  );
  if (deleteError || insertError) return { error: "write_failed" };

  await supabase.from("integration_audit").insert({
    user_id: userId,
    client_id: clientId,
    action,
    detail: { categories: owned.map((c) => c.name) },
  });
  return {};
}

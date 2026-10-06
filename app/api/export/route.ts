import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";

export const runtime = "nodejs";

/**
 * Exporta todo lo que la app guarda del usuario, en JSON (derecho de acceso y
 * portabilidad, Ley 29733). Corre con la sesión del propio usuario, así que RLS
 * garantiza que nadie pueda pedir los datos de otro.
 *
 * No se exportan los tokens de Google: son credenciales, no datos del usuario, y
 * entregarlas en claro sería crear el problema que el cifrado evita.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const supabase = await createClient();

  const [categories, subcategories, methods, challenges, { rows: expenses }] = await Promise.all([
    supabase.from("categories").select("id, name, created_at").eq("user_id", user.id),
    supabase.from("subcategories").select("id, name, category_id, created_at").eq("user_id", user.id),
    supabase
      .from("payment_methods")
      .select("id, type, identifier, alias, created_at")
      .eq("user_id", user.id),
    supabase
      .from("challenges")
      .select("id, category_id, subcategory_id, target_days, started_on, ended_on, outcome")
      .eq("user_id", user.id),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("expenses")
        .select(
          "id, merchant, amount, currency, occurred_at, source, subcategory_id, payment_method_id, operation_number, document_number, created_at",
        )
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
    paymentMethods: methods.data ?? [],
    challenges: challenges.data ?? [],
    expenses,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bernie-wallet-${new Date().toISOString().slice(0, 10)}.json"`,
      // Datos personales: que no queden en ninguna caché intermedia.
      "Cache-Control": "no-store, private",
    },
  });
}

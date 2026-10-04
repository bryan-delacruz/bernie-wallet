"use server";

import { revalidatePath } from "next/cache";
import { scheduleWebhookDelivery } from "@/lib/integrations/webhook-delivery";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ExpenseResult = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function refresh(taxonomyChanged = false) {
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  // Una categoría/subcategoría creada al paso también cambia /categories.
  if (taxonomyChanged) revalidatePath("/categories");
  // Si el gasto es de una categoría compartida, un trigger ya encoló el aviso.
  scheduleWebhookDelivery();
}

const MAX_NAME_LENGTH = 40;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

type Taxonomy = {
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
async function resolveTaxonomy(
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

/** Lee y valida los campos comunes del formulario de gasto. */
function readExpenseForm(formData: FormData):
  | { error: string }
  | {
      amount: number;
      currency: string;
      merchant: string;
      occurredAt: string;
      taxonomy: Taxonomy;
      paymentMethodId: string | null;
    } {
  const amount = Number(formData.get("amount"));
  const merchant = String(formData.get("merchant") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  const currency = String(formData.get("currency") ?? "PEN");
  const paymentMethodId = formData.get("paymentMethodId");

  const text = (key: string) => {
    const value = formData.get(key);
    return value ? String(value) : null;
  };

  if (!merchant || !Number.isFinite(amount) || amount <= 0 || !dateStr) {
    return { error: "Revisa el monto, el comercio y la fecha." };
  }

  return {
    amount,
    currency,
    merchant,
    // Mediodía local para evitar que la fecha "salte" de día por zona horaria.
    occurredAt: new Date(`${dateStr}T12:00:00`).toISOString(),
    taxonomy: {
      categoryId: text("categoryId"),
      categoryName: text("categoryName"),
      subcategoryId: text("subcategoryId"),
      subcategoryName: text("subcategoryName"),
    },
    paymentMethodId: paymentMethodId ? String(paymentMethodId) : null,
  };
}

export async function createExpense(formData: FormData): Promise<ExpenseResult> {
  const parsed = readExpenseForm(formData);
  if ("error" in parsed) return parsed;
  const { supabase, userId } = await requireUser();

  const resolved = await resolveTaxonomy(supabase, userId, parsed.taxonomy);
  if ("error" in resolved) return resolved;

  const { error } = await supabase.from("expenses").insert({
    user_id: userId,
    amount: parsed.amount,
    currency: parsed.currency,
    merchant: parsed.merchant,
    occurred_at: parsed.occurredAt,
    subcategory_id: resolved.subcategoryId,
    payment_method_id: parsed.paymentMethodId,
    source: "manual",
  });
  if (error) return { error: "No se pudo guardar el gasto." };

  refresh(resolved.created);
  return {};
}

export async function updateExpense(id: string, formData: FormData): Promise<ExpenseResult> {
  const parsed = readExpenseForm(formData);
  if ("error" in parsed) return parsed;
  const { supabase, userId } = await requireUser();

  const resolved = await resolveTaxonomy(supabase, userId, parsed.taxonomy);
  if ("error" in resolved) return resolved;

  const { error } = await supabase
    .from("expenses")
    .update({
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      occurred_at: parsed.occurredAt,
      subcategory_id: resolved.subcategoryId,
      payment_method_id: parsed.paymentMethodId,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo actualizar el gasto." };

  refresh(resolved.created);
  return {};
}

export async function deleteExpense(id: string): Promise<ExpenseResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: "No se pudo eliminar el gasto." };

  refresh();
  return {};
}

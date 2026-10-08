"use server";

import { revalidatePath } from "next/cache";
import { scheduleWebhookDelivery } from "@/lib/integrations/webhook-delivery";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTaxonomy, type Taxonomy } from "@/lib/taxonomy";

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

/**
 * Descarta el aviso de ordenar pendientes y recuerda con cuántos se descartó
 * (SPEC §18.6). El conteo se vuelve a leer acá y no se recibe del cliente: es el
 * número contra el que después se mide si el backlog creció lo suficiente para
 * volver a avisar.
 */
export async function dismissCategorizeHint(): Promise<ExpenseResult> {
  const { supabase, userId } = await requireUser();

  const { count } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("subcategory_id", null);

  const { error } = await supabase
    .from("users")
    .update({
      categorize_hint_dismissed_at: new Date().toISOString(),
      categorize_hint_pending_at: count ?? 0,
    })
    .eq("id", userId);
  if (error) return { error: "No se pudo guardar la preferencia." };

  revalidatePath("/activity");
  return {};
}

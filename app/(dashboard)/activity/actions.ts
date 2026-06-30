"use server";

import { revalidatePath } from "next/cache";
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

function refresh() {
  revalidatePath("/activity");
  revalidatePath("/dashboard");
}

/** Lee y valida los campos comunes del formulario de gasto. */
function readExpenseForm(formData: FormData):
  | { error: string }
  | {
      amount: number;
      currency: string;
      merchant: string;
      occurredAt: string;
      subcategoryId: string | null;
      paymentMethodId: string | null;
    } {
  const amount = Number(formData.get("amount"));
  const merchant = String(formData.get("merchant") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  const currency = String(formData.get("currency") ?? "PEN");
  const subcategoryId = formData.get("subcategoryId");
  const paymentMethodId = formData.get("paymentMethodId");

  if (!merchant || !Number.isFinite(amount) || amount <= 0 || !dateStr) {
    return { error: "Revisa el monto, el comercio y la fecha." };
  }

  return {
    amount,
    currency,
    merchant,
    // Mediodía local para evitar que la fecha "salte" de día por zona horaria.
    occurredAt: new Date(`${dateStr}T12:00:00`).toISOString(),
    subcategoryId: subcategoryId ? String(subcategoryId) : null,
    paymentMethodId: paymentMethodId ? String(paymentMethodId) : null,
  };
}

export async function createExpense(formData: FormData): Promise<ExpenseResult> {
  const parsed = readExpenseForm(formData);
  if ("error" in parsed) return parsed;
  const { supabase, userId } = await requireUser();

  const { error } = await supabase.from("expenses").insert({
    user_id: userId,
    amount: parsed.amount,
    currency: parsed.currency,
    merchant: parsed.merchant,
    occurred_at: parsed.occurredAt,
    subcategory_id: parsed.subcategoryId,
    payment_method_id: parsed.paymentMethodId,
    source: "manual",
  });
  if (error) return { error: "No se pudo guardar el gasto." };

  refresh();
  return {};
}

export async function updateExpense(id: string, formData: FormData): Promise<ExpenseResult> {
  const parsed = readExpenseForm(formData);
  if ("error" in parsed) return parsed;
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("expenses")
    .update({
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      occurred_at: parsed.occurredAt,
      subcategory_id: parsed.subcategoryId,
      payment_method_id: parsed.paymentMethodId,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo actualizar el gasto." };

  refresh();
  return {};
}

export async function deleteExpense(id: string): Promise<ExpenseResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: "No se pudo eliminar el gasto." };

  refresh();
  return {};
}

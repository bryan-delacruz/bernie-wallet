"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/activity");
}

const PAYMENT_TYPES = ["credit_card", "debit_card", "yape", "account"] as const;
const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

function readPaymentForm(formData: FormData):
  | { error: string }
  | { userBankId: string; type: string; identifier: string; alias: string } {
  const userBankId = String(formData.get("userBankId") ?? "");
  const type = String(formData.get("type") ?? "");
  const identifier = String(formData.get("identifier") ?? "").trim();
  const aliasRaw = String(formData.get("alias") ?? "").trim();

  if (!userBankId || !PAYMENT_TYPES.includes(type as (typeof PAYMENT_TYPES)[number]) || !identifier) {
    return { error: "Completa banco, tipo e identificador." };
  }
  return {
    userBankId,
    type,
    identifier,
    alias: aliasRaw || `${TIPO_LABEL[type]} ${identifier}`,
  };
}

export async function createPaymentMethod(formData: FormData): Promise<ActionResult> {
  const parsed = readPaymentForm(formData);
  if ("error" in parsed) return parsed;
  const { supabase, userId } = await requireUser();

  const { error } = await supabase.from("payment_methods").insert({
    user_id: userId,
    user_bank_id: parsed.userBankId,
    type: parsed.type,
    identifier: parsed.identifier,
    alias: parsed.alias,
  });
  if (error) return { error: "No se pudo crear el medio de pago." };

  refresh();
  return {};
}

export async function updatePaymentMethod(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = readPaymentForm(formData);
  if ("error" in parsed) return parsed;
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("payment_methods")
    .update({
      user_bank_id: parsed.userBankId,
      type: parsed.type,
      identifier: parsed.identifier,
      alias: parsed.alias,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo actualizar el medio de pago." };

  refresh();
  return {};
}

export async function deletePaymentMethod(id: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo eliminar el medio de pago." };

  refresh();
  return {};
}

export async function connectBank(systemBankId: string, alias: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  const { data: existing } = await supabase
    .from("user_banks")
    .select("id")
    .eq("user_id", userId)
    .eq("system_bank_id", systemBankId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("user_banks")
      .insert({ user_id: userId, system_bank_id: systemBankId, alias });
    if (error) return { error: "No se pudo conectar el banco." };
  }

  refresh();
  return {};
}

export async function disconnectBank(systemBankId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("user_banks")
    .delete()
    .eq("user_id", userId)
    .eq("system_bank_id", systemBankId);
  if (error) return { error: "No se pudo desconectar el banco." };
  refresh();
  return {};
}

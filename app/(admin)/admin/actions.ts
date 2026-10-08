"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminResult = { error?: string };

/**
 * Enciende o apaga una bandera de un banco, y lo deja anotado (SPEC §17.4).
 *
 * La autorización no se verifica acá: `system_banks` solo la pueden escribir los
 * admins por política de base, y `admin_audit` registra quién lo hizo. El guard de
 * la página evitaría llegar, pero no es lo que protege.
 */
export async function setBankFlag(
  bankId: string,
  flag: "active" | "discovering",
  value: boolean,
): Promise<AdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: before } = await supabase
    .from("system_banks")
    .select("official_name, active, discovering")
    .eq("id", bankId)
    .maybeSingle();
  if (!before) return { error: "Ese banco no existe." };

  const { error } = await supabase
    .from("system_banks")
    .update({ [flag]: value })
    .eq("id", bankId);
  if (error) return { error: "No se pudo guardar. ¿Tu cuenta sigue siendo admin?" };

  await supabase.from("admin_audit").insert({
    admin_id: user.id,
    action: `bank.${flag}`,
    target: before.official_name,
    before: { [flag]: before[flag] },
    after: { [flag]: value },
  });

  revalidatePath("/admin");
  return {};
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Completa el onboarding del primer login. El banco es opcional: solo configura
 * qué correos revisaremos al sincronizar. Marca onboarded_at en todos los casos.
 *
 * Verifica cada escritura: si onboarded_at no se persiste, NO redirige al
 * dashboard (evita el bucle silencioso) y deja el error en los logs.
 */
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bank = formData.get("bank");

  if (bank === "BCP") {
    const { data: systemBank, error: bankErr } = await supabase
      .from("system_banks")
      .select("id")
      .eq("official_name", "BCP")
      .maybeSingle();

    if (bankErr) {
      console.error("[onboarding] system_banks lookup falló:", bankErr.message);
    }
    if (systemBank) {
      const { error: ubErr } = await supabase.from("user_banks").insert({
        user_id: user.id,
        system_bank_id: systemBank.id,
        alias: "BCP",
      });
      // 23505 = ya estaba conectado (no es fatal); el resto se loguea.
      if (ubErr && ubErr.code !== "23505") {
        console.error("[onboarding] user_banks insert falló:", ubErr.message);
      }
    }
  }

  // Marcar onboarded_at y confirmar que la fila realmente se actualizó.
  const { data: updated, error: updErr } = await supabase
    .from("users")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (updErr || !updated) {
    console.error("[onboarding] no se pudo marcar onboarded_at", {
      userId: user.id,
      error: updErr?.message ?? "0 filas actualizadas",
    });
    redirect("/onboarding?error=save");
  }

  redirect("/dashboard");
}

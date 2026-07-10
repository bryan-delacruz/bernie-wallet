"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Completa el onboarding del primer login. El banco es opcional: solo configura
 * qué correos revisaremos al sincronizar. Marca onboarded_at en todos los casos.
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
    const { data: systemBank } = await supabase
      .from("system_banks")
      .select("id")
      .eq("official_name", "BCP")
      .single();

    if (systemBank) {
      await supabase.from("user_banks").insert({
        user_id: user.id,
        system_bank_id: systemBank.id,
        alias: "BCP",
      });
    }
  }

  await supabase
    .from("users")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/dashboard");
}

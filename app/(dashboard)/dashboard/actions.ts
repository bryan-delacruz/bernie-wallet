"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { limaToday } from "@/lib/format";

export type ChallengeResult = { error?: string };

const TARGET_DAYS = [7, 14, 30];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/**
 * Empieza un reto (SPEC §16.6.1). El objetivo llega como "cat:<id>" o "sub:<id>":
 * un solo campo en el formulario para una decisión que el usuario vive como una
 * sola ("¿sin qué?").
 */
export async function startChallenge(formData: FormData): Promise<ChallengeResult> {
  const { supabase, userId } = await requireUser();

  const target = String(formData.get("target") ?? "");
  const targetDays = Number(formData.get("targetDays"));
  const [kind, id] = target.split(":");

  if (!id || (kind !== "cat" && kind !== "sub")) return { error: "Elige una categoría." };
  if (!TARGET_DAYS.includes(targetDays)) return { error: "Elige una duración." };

  const { error } = await supabase.from("challenges").insert({
    user_id: userId,
    category_id: kind === "cat" ? id : null,
    subcategory_id: kind === "sub" ? id : null,
    target_days: targetDays,
    started_on: limaToday(),
  });

  // 23505 = el índice único parcial: ya hay un reto activo (uno a la vez).
  if (error) {
    return { error: error.code === "23505" ? "Ya tienes un reto en curso." : "No se pudo empezar el reto." };
  }

  revalidatePath("/dashboard");
  return {};
}

/** Termina el reto por decisión del usuario. Romperlo no lo cierra: eso reinicia
 *  el contador solo, sin pasar por acá. */
export async function abandonChallenge(formData: FormData): Promise<ChallengeResult> {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el reto." };

  const { error } = await supabase
    .from("challenges")
    .update({ outcome: "abandoned", ended_on: limaToday() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("outcome", "active");

  if (error) return { error: "No se pudo terminar el reto." };

  revalidatePath("/dashboard");
  return {};
}

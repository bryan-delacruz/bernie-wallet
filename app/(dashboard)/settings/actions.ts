"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidCategorySelection, replaceShares } from "@/lib/integrations/shares";
import { scheduleWebhookDelivery } from "@/lib/integrations/webhook-delivery";
import { deleteAuthUser, revokeGoogleAccess } from "@/lib/account";

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

// ---------- Apps conectadas (SPEC §15.8) ----------

export async function updateAppShares(
  clientId: string,
  categoryIds: string[],
): Promise<ActionResult> {
  if (typeof clientId !== "string" || !clientId) return { error: "App no válida." };
  if (!isValidCategorySelection(categoryIds)) {
    return { error: "Elige al menos una categoría. Para dejar de compartir, desconecta la app." };
  }
  const { supabase, userId } = await requireUser();

  // Solo apps realmente conectadas (RLS: solo las propias).
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("client_id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!connection) return { error: "Esta app ya no está conectada." };

  const res = await replaceShares(supabase, userId, clientId, categoryIds, "shares_changed");
  if (res.error) return { error: "No se pudieron guardar las categorías." };
  scheduleWebhookDelivery();
  revalidatePath("/settings");
  return {};
}

/**
 * Desconectar: primero se revoca el grant en Supabase Auth (invalida los
 * refresh tokens de la app) y después se borra la conexión en la base. En ese
 * orden, nunca queda un grant vivo sin conexión, que haría que Supabase
 * auto-apruebe la próxima conexión saltándose la pantalla de consentimiento.
 */
export async function disconnectApp(clientId: string): Promise<ActionResult & { partial?: boolean }> {
  if (typeof clientId !== "string" || !clientId) return { error: "App no válida." };
  const { supabase } = await requireUser();

  const { error: grantError } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (grantError) return { error: "No se pudo desconectar la app. Inténtalo de nuevo." };

  const { error } = await supabase.rpc("revoke_integration", { p_client_id: clientId });
  scheduleWebhookDelivery(); // grant.revoked
  revalidatePath("/settings");
  // El grant ya no existe, así que la app no puede renovar su acceso aunque la
  // base falle; se reintenta desde Configuración.
  return error ? { partial: true } : {};
}

/** Quita un permiso que quedó en Supabase Auth sin conexión en Bernie. */
export async function revokeOrphanGrant(clientId: string): Promise<ActionResult> {
  if (typeof clientId !== "string" || !clientId) return { error: "App no válida." };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) return { error: "No se pudo quitar el acceso. Inténtalo de nuevo." };
  revalidatePath("/settings");
  return {};
}

/** Primer día de la semana (SPEC §16.5). Afecta la grilla de la racha y la
 *  imagen compartible; el default de un usuario nuevo es lunes. */
export async function updateWeekStart(weekStart: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (weekStart !== "monday" && weekStart !== "sunday") return { error: "Opción inválida." };

  const { error } = await supabase
    .from("users")
    .update({ week_starts_on: weekStart })
    .eq("id", userId);
  if (error) return { error: "No se pudo guardar la preferencia." };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Borra la cuenta y todo lo que cuelga de ella (derecho de supresión, Ley 29733).
 * Irreversible y sin copia: lo que se borra, se borra.
 */
export async function deleteAccount(): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  // Primero Google: que deje de tener acceso al Gmail aunque lo demás falle.
  const { data: token } = await supabase
    .from("google_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  await revokeGoogleAccess(token?.refresh_token ?? null);

  // La fila de users arrastra en cascada gastos, categorías, medios, tokens y retos.
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) return { error: "No se pudo borrar la cuenta. Intenta de nuevo." };

  // Sin secret key el usuario queda en auth.users sin datos: puede volver a entrar
  // y se le vuelve a sembrar el perfil. Molesto, no peligroso.
  await deleteAuthUser(userId);
  await supabase.auth.signOut();

  redirect("/");
}

/** Prende o apaga el aviso de ordenar pendientes en Actividad (SPEC §18.6). */
export async function updateCategorizeHint(enabled: boolean): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("users")
    // Prenderlo de nuevo limpia el descarte: el usuario está pidiendo verlo.
    .update(
      enabled
        ? {
            categorize_hint_enabled: true,
            categorize_hint_dismissed_at: null,
            categorize_hint_pending_at: null,
          }
        : { categorize_hint_enabled: false },
    )
    .eq("id", userId);
  if (error) return { error: "No se pudo guardar la preferencia." };

  revalidatePath("/settings");
  revalidatePath("/activity");
  return {};
}

/** Guarda la suscripción push del navegador y prende la notificación diaria. */
export async function enableDailyNotification(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<ActionResult> {
  const { endpoint, p256dh, auth } = subscription;
  if (!endpoint || !p256dh || !auth) return { error: "Suscripción incompleta." };
  if (!/^https:\/\//.test(endpoint)) return { error: "Suscripción inválida." };

  const { supabase, userId } = await requireUser();

  // Un endpoint es un navegador: si ya existe, se reasigna por si cambió de cuenta.
  const { error: subError } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint, p256dh, auth, failed_at: null }, { onConflict: "endpoint" });
  if (subError) return { error: "No se pudo guardar la suscripción." };

  const { error } = await supabase
    .from("users")
    .update({ daily_notification_enabled: true })
    .eq("id", userId);
  if (error) return { error: "No se pudo guardar la preferencia." };

  revalidatePath("/settings");
  return {};
}

/**
 * Apaga la notificación diaria. Borra la suscripción de **este** navegador si se
 * indica; las de otros equipos quedan, pero el interruptor apagado las frena.
 */
export async function disableDailyNotification(endpoint?: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  if (endpoint) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
  }

  const { error } = await supabase
    .from("users")
    .update({ daily_notification_enabled: false })
    .eq("id", userId);
  if (error) return { error: "No se pudo guardar la preferencia." };

  revalidatePath("/settings");
  return {};
}

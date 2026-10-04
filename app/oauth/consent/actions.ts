"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoUser } from "@/lib/demo";
import { isValidCategorySelection, replaceShares } from "@/lib/integrations/shares";
import { scheduleWebhookDelivery } from "@/lib/integrations/webhook-delivery";

export type ConsentResult = { error?: string };

const GENERIC_ERROR = "No pudimos completar la autorización. Vuelve a intentarlo desde la app.";

/**
 * Permitir (SPEC §15.5): guarda la conexión y las categorías elegidas, deja el
 * registro en la auditoría y recién entonces aprueba en Supabase Auth, que
 * devuelve la URL de vuelta a la app con el código.
 */
export async function approveConsent(
  authorizationId: string,
  categoryIds: string[],
): Promise<ConsentResult> {
  if (
    typeof authorizationId !== "string" ||
    !authorizationId ||
    authorizationId.length > 200 ||
    !isValidCategorySelection(categoryIds)
  ) {
    return { error: "Elige al menos una categoría para compartir." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || isDemoUser(user)) return { error: "Necesitas una cuenta de Bernie para conectar apps." };

  // El cliente sale de Supabase, nunca del formulario: así nadie puede
  // aprobar una solicitud a nombre de otra app.
  const { data: details, error: detailsError } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsError || !details || !("authorization_id" in details)) {
    return { error: "La solicitud expiró. Vuelve a conectar desde la app." };
  }
  const client = details.client;

  const { data: existing } = await supabase
    .from("integration_connections")
    .select("client_id")
    .eq("user_id", user.id)
    .eq("client_id", client.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("integration_connections")
      .update({ client_name: client.name, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("client_id", client.id);
  } else {
    const { error } = await supabase
      .from("integration_connections")
      .insert({ user_id: user.id, client_id: client.id, client_name: client.name });
    if (error) {
      // 23503: la app existe en Supabase pero no está habilitada en integration_clients.
      return {
        error:
          error.code === "23503"
            ? `${client.name} no está habilitada para conectarse a Bernie.`
            : GENERIC_ERROR,
      };
    }
  }

  const shares = await replaceShares(
    supabase,
    user.id,
    client.id,
    categoryIds,
    existing ? "shares_changed" : "granted",
  );
  if (shares.error) return { error: GENERIC_ERROR };
  scheduleWebhookDelivery();

  const { data: approved, error: approveError } = await supabase.auth.oauth.approveAuthorization(
    authorizationId,
    { skipBrowserRedirect: true },
  );
  if (approveError || !approved) return { error: GENERIC_ERROR };

  redirect(approved.redirect_url);
}

/** Cancelar: Supabase devuelve la URL de la app con error=access_denied. */
export async function denyConsent(authorizationId: string): Promise<ConsentResult> {
  if (typeof authorizationId !== "string" || !authorizationId || authorizationId.length > 200) {
    return { error: GENERIC_ERROR };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
  if (error || !data) return { error: "La solicitud expiró. Puedes cerrar esta ventana." };
  redirect(data.redirect_url);
}

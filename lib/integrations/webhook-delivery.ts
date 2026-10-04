import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { decrypt } from "@/lib/crypto";
import { webhookHeaders } from "@/lib/integrations/webhook-signature";

/**
 * Entrega de webhooks a las apps conectadas (SPEC §15.7). Los eventos los
 * encolan triggers de la base (integration_events); aquí solo se envían.
 * Corre con la secret key porque lee tablas de sistema que ningún usuario ve.
 */
function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type ClaimedEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  created_at: string;
  webhook_url: string;
  webhook_secret: string | null;
};

const TIMEOUT_MS = 10_000;

/** https siempre; http solo hacia localhost (desarrollo). */
function isAllowedUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

async function send(event: ClaimedEvent): Promise<{ ok: boolean; error?: string }> {
  if (!event.webhook_secret || !isAllowedUrl(event.webhook_url)) {
    return { ok: false, error: "misconfigured_client" };
  }
  const body = JSON.stringify({
    type: event.type,
    timestamp: new Date(event.created_at).toISOString(),
    data: event.payload,
  });
  const secret = decrypt(event.webhook_secret, "INTEGRATION_SECRET_KEY");
  try {
    const res = await fetch(event.webhook_url, {
      method: "POST",
      headers: webhookHeaders(secret, event.id, Math.floor(Date.now() / 1000), body),
      body,
      // Un 3xx no cuenta como entregado: el receptor debe responder 2xx.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : "network_error" };
  }
}

/** Reclama y envía lo pendiente. Seguro de llamar en paralelo (lease + skip locked). */
export async function deliverPending(limit = 50) {
  const supabase = serviceClient();
  if (!supabase) return { delivered: 0, failed: 0, skipped: true as const };

  const { data, error } = await supabase.rpc("claim_integration_events", { p_limit: limit });
  if (error) throw new Error(`claim_integration_events: ${error.message}`);

  const events = (data ?? []) as ClaimedEvent[];
  const results = await Promise.all(
    events.map(async (event) => {
      const result = await send(event);
      await supabase.rpc("complete_integration_event", {
        p_id: event.id,
        p_ok: result.ok,
        p_error: result.error ?? null,
      });
      return result.ok;
    }),
  );

  const delivered = results.filter(Boolean).length;
  const summary = { delivered, failed: results.length - delivered };
  if (results.length) console.log(JSON.stringify({ event: "webhook_delivery", ...summary }));
  return summary;
}

/**
 * Intenta entregar al terminar la respuesta (after): el aviso llega en segundos
 * sin hacer esperar al usuario. Si falla, pg_cron reintenta cada minuto.
 */
export function scheduleWebhookDelivery() {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  after(async () => {
    try {
      await deliverPending(20);
    } catch (error) {
      console.error("[webhooks] entrega inmediata falló:", error instanceof Error ? error.message : error);
    }
  });
}

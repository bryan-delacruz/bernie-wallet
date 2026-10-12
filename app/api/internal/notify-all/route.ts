import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push/send";
import { limaToday } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Suscripciones por corrida. Acota el tiempo del request. */
const MAX_SUBSCRIPTIONS = Number(process.env.NOTIFY_CRON_MAX) || 500;

function authorized(request: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Empuja el saludo diario de Bernie (SPEC §20.5). La llama `pg_cron` a las 15:00
 * UTC, que son las 10:00 de Lima.
 *
 * El aviso va **vacío**: el service worker pide la frase a
 * `/api/notifications/today` cuando lo recibe. Por eso acá no hay nada del
 * contenido ni de la racha — solo a quién avisar.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });

  // Vercel guarda el valor tal cual se pegó: si vino con comillas alrededor, hay
  // que sacarlas, y los `\n` escritos como texto tienen que volver a ser saltos.
  const privateKeyPem = process.env.VAPID_PRIVATE_KEY?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
  const subject = process.env.VAPID_SUBJECT;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!privateKeyPem || !subject || !key) return new Response(null, { status: 503 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Solo quienes prendieron el interruptor. El opt-in vive en `users`, así que el
  // filtro evita empujar a quien lo apagó sin haber borrado su suscripción.
  //
  // `last_notified_on` nulo es quien nunca recibió nada, y hay que incluirlo
  // explícitamente: en SQL `null <> '2026-10-12'` no es verdadero sino nulo, así
  // que un `neq` a secas deja afuera justo a los que esperan su primer saludo.
  const today = limaToday();
  const { data: wanted, error } = await admin
    .from("users")
    .select("id")
    .eq("daily_notification_enabled", true)
    .or(`last_notified_on.is.null,last_notified_on.neq.${today}`)
    .limit(MAX_SUBSCRIPTIONS);
  if (error) return Response.json({ error: "no se pudo leer usuarios" }, { status: 500 });

  const userIds = (wanted ?? []).map((u) => u.id);
  if (!userIds.length) return Response.json({ usuarios: 0, enviados: 0 });

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint")
    .in("user_id", userIds)
    .limit(MAX_SUBSCRIPTIONS);

  let enviados = 0;
  let muertas = 0;
  let fallidos = 0;
  /** Primer motivo de fallo, para que la respuesta diga qué pasó y no solo cuántos. */
  let motivo: string | null = null;

  for (const subscription of subscriptions ?? []) {
    const result = await sendPush(subscription.endpoint, { subject, privateKeyPem });

    if (result.status === "sent") {
      enviados++;
      continue;
    }
    if (result.status === "gone") {
      // El navegador la revocó: borrarla, no reintentarla eternamente.
      muertas++;
      await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      continue;
    }
    fallidos++;
    motivo ??= result.reason;
    await admin
      .from("push_subscriptions")
      .update({ failed_at: new Date().toISOString() })
      .eq("id", subscription.id);
  }

  return Response.json({ usuarios: userIds.length, enviados, muertas, fallidos, motivo });
}

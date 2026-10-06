import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GmailAuthError } from "@/lib/gmail/gmail-service";
import { recordSyncError, runSync } from "@/lib/sync/run-sync";

// Usa node:crypto (cifrado del token) y Buffer → forzamos runtime Node.
export const runtime = "nodejs";

/**
 * Mínimo entre dos sincronizaciones manuales del mismo usuario. La cuota de Gmail
 * es del proyecto, no de la persona: sin este tope, alguien impaciente apretando el
 * botón puede dejar sin sincronizar a los demás. Dos minutos es holgado para quien
 * acaba de comprar algo y quiere verlo aparecer.
 */
const MIN_INTERVAL_MS = 2 * 60 * 1000;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.is_anonymous) {
    return NextResponse.json({
      message: "En la demo los gastos ya vienen cargados. Con tu cuenta se leen de Gmail.",
    });
  }

  const { data: lastRun } = await supabase
    .from("sync_logs")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRun?.created_at) {
    const elapsed = Date.now() - new Date(lastRun.created_at).getTime();
    if (elapsed < MIN_INTERVAL_MS) {
      const wait = Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: `Acabas de sincronizar. Prueba de nuevo en ${wait} segundos.`,
          code: "rate_limited",
        },
        { status: 429 },
      );
    }
  }

  try {
    return NextResponse.json(await runSync(supabase, user.id));
  } catch (error) {
    // Problema de acceso a Gmail (reconectable): el cliente muestra un modal que
    // sugiere cerrar sesión y volver a entrar, o continuar sin reconectar.
    const gmailAuth = error instanceof GmailAuthError;
    // Queda constancia de la corrida fallida: sin esto, el usuario ve gastos que no
    // aparecen y del lado de acá no hay forma de saberlo.
    await recordSyncError(supabase, user.id, "manual", gmailAuth ? "gmail_auth" : "unexpected");

    if (gmailAuth) {
      return NextResponse.json({ error: error.message, code: "gmail_auth" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Error al sincronizar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

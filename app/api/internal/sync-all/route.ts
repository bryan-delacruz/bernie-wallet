import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { GmailAuthError } from "@/lib/gmail/gmail-service";
import { runSync } from "@/lib/sync/run-sync";

export const runtime = "nodejs";
// Recorrer a varios usuarios contra Gmail lleva su tiempo; el default de Vercel
// (300s) alcanza, pero lo dejamos explícito para que no sorprenda.
export const maxDuration = 300;

/** Usuarios por corrida. Acota el tiempo del request; el resto entra en la siguiente. */
const MAX_USERS = Number(process.env.SYNC_CRON_MAX_USERS) || 50;

function authorized(request: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Sincroniza a todos los usuarios conectados. La llama `pg_cron` tres veces al día
 * (SPEC §9.1): sin esto, "tus gastos se anotan solos" solo es cierto mientras
 * alguien aprieta el botón.
 *
 * Corre con la secret key porque atiende a varios usuarios en un request, así que
 * no hay sesión que valga. `runSync` filtra por `user_id` en cada consulta: acá no
 * hay RLS que respalde el aislamiento, lo hace el código.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });

  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return new Response(null, { status: 503 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Solo quienes tienen Gmail conectado: sin token no hay nada que leer.
  const { data: connected, error } = await admin
    .from("google_tokens")
    .select("user_id")
    .limit(MAX_USERS);
  if (error) return new Response(null, { status: 500 });

  let usuarios = 0;
  let nuevos = 0;
  let sinAcceso = 0;
  let fallidos = 0;

  for (const { user_id } of connected ?? []) {
    try {
      const result = await runSync(admin, user_id);
      usuarios += 1;
      nuevos += result.nuevos;
    } catch (error) {
      // Un usuario que revocó el permiso no puede frenar al resto: se cuenta y se
      // sigue. Lo nota en la app, donde se le ofrece reconectar.
      if (error instanceof GmailAuthError) sinAcceso += 1;
      else fallidos += 1;
    }
  }

  // Conteos, nunca contenido (§14.4).
  console.log(
    JSON.stringify({ event: "sync_cron", usuarios, nuevos, sinAcceso, fallidos }),
  );
  return Response.json(
    { usuarios, nuevos, sinAcceso, fallidos },
    { headers: { "Cache-Control": "no-store" } },
  );
}

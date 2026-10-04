import { createClient, isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { problem } from "@/lib/integrations/problem";

export type IntegrationContext = {
  /** Cliente de Supabase que actúa con el token de la app: RLS y funciones lo ven a él. */
  supabase: SupabaseClient;
  token: string;
  userId: string;
  clientId: string;
};

/**
 * Autentica a una app conectada (SPEC §15.3). Valida firma y expiración con
 * getClaims y exige el claim `client_id`: una sesión normal de Bernie no sirve
 * aquí. Que la app esté registrada, activa y conectada lo valida la base.
 */
export async function authenticateClient(
  request: Request,
): Promise<IntegrationContext | Response> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return problem("unauthorized");
  const token = match[1];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );

  // Token mal formado → 401. Pero si Supabase no responde (getClaims valida
  // llamando a Auth con llaves HS256), es un 503: un 401 haría creer a la app
  // que el usuario la desconectó y la obligaría a reconectar por una caída.
  if (!looksLikeJwt(token)) return problem("unauthorized");
  let result;
  try {
    result = await supabase.auth.getClaims(token);
  } catch {
    return problem("unavailable");
  }
  if (result.error) {
    const transient = isAuthRetryableFetchError(result.error) || (result.error.status ?? 0) >= 500;
    return problem(transient ? "unavailable" : "unauthorized");
  }
  const claims = result.data?.claims;
  const clientId = claims?.client_id;
  if (!claims?.sub || typeof clientId !== "string") {
    return problem("unauthorized");
  }

  return { supabase, token, userId: claims.sub, clientId };
}

/** Tres partes base64url con header y payload JSON; si no, ni se intenta validar. */
function looksLikeJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return true;
  } catch {
    return false;
  }
}

/** Códigos de Postgres/PostgREST que lanzan las funciones de la migración 0009. */
export function mapDbError(error: { code?: string; message?: string }): Response {
  if (error.code === "PT409") return problem("cursor_reset");
  if (error.code === "42501") return problem("not_connected");
  if (error.code === "22023") return problem("invalid_request", error.message);
  return problem("internal");
}

/**
 * Rate limit por (app, usuario) — SPEC §15.2. Devuelve las cabeceras RateLimit-*
 * para la respuesta, o un 429 listo.
 */
export async function consumeRateLimit(
  ctx: IntegrationContext,
  limit = 60,
): Promise<{ headers: Record<string, string> } | Response> {
  const { data, error } = await ctx.supabase.rpc("consume_rate_limit", { p_limit: limit }).single<{
    allowed: boolean;
    remaining: number;
    reset_at: string;
  }>();
  if (error || !data) return mapDbError(error ?? {});

  const resetSeconds = Math.max(1, Math.ceil((Date.parse(data.reset_at) - Date.now()) / 1000));
  const headers = {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(data.remaining),
    "RateLimit-Reset": String(resetSeconds),
  };
  if (!data.allowed) {
    return problem("rate_limited", undefined, { ...headers, "Retry-After": String(resetSeconds) });
  }
  return { headers };
}

/** Log estructurado por request, sin montos ni comercios (SPEC §15.6). */
export function logApi(entry: {
  route: string;
  status: number;
  startedAt: number;
  clientId?: string;
  userId?: string;
  note?: string;
}) {
  const { startedAt, ...rest } = entry;
  console.log(JSON.stringify({ event: "integration_api", ...rest, ms: Date.now() - startedAt }));
}

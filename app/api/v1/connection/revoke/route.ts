import { problem } from "@/lib/integrations/problem";
import {
  authenticateClient,
  consumeRateLimit,
  logApi,
  mapDbError,
} from "@/lib/integrations/client-auth";

export const runtime = "nodejs";

const ROUTE = "POST /api/v1/connection/revoke";

/**
 * La app se desconecta a sí misma (SPEC §15.6). Supabase no expone revocación
 * RFC 7009, por eso existe este endpoint.
 *
 * 1. En Supabase Auth: revoca el grant e invalida sus refresh tokens.
 * 2. En la base: borra la conexión y sus categorías compartidas.
 *
 * El orden importa: si el grant sobreviviera sin conexión, Supabase
 * auto-aprobaría la próxima conexión sin pasar por /oauth/consent y la app
 * quedaría conectada sin categorías. Si el paso 1 falla, se responde 503 y no
 * se toca nada: la app borra sus tokens igual y el usuario sigue viendo la
 * conexión en Configuración, desde donde puede quitarla.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const ctx = await authenticateClient(request);
  if (ctx instanceof Response) {
    logApi({ route: ROUTE, status: ctx.status, startedAt });
    return ctx;
  }
  const who = { clientId: ctx.clientId, userId: ctx.userId };

  const rate = await consumeRateLimit(ctx);
  if (rate instanceof Response) {
    logApi({ route: ROUTE, status: rate.status, startedAt, ...who });
    return rate;
  }

  const grant = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user/oauth/grants?client_id=${encodeURIComponent(ctx.clientId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${ctx.token}`,
      },
    },
  ).catch(() => null);
  if (!grant?.ok) {
    const res = problem("unavailable", "Could not revoke the grant; nothing was changed", rate.headers);
    logApi({ route: ROUTE, status: res.status, startedAt, ...who, note: `grant_revoke_failed:${grant?.status ?? "network"}` });
    return res;
  }

  const { error } = await ctx.supabase.rpc("revoke_integration", { p_client_id: ctx.clientId });
  if (error) {
    const res = mapDbError(error);
    logApi({ route: ROUTE, status: res.status, startedAt, ...who, note: "grant_revoked_db_failed" });
    return res;
  }

  logApi({ route: ROUTE, status: 204, startedAt, ...who, note: "grant_revoked" });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...rate.headers } });
}

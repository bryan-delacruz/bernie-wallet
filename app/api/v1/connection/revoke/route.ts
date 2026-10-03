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
 * 1. En la base: borra la conexión y sus categorías compartidas. Desde ese
 *    momento la app ya no lee nada, aunque su token siga vigente.
 * 2. En Supabase Auth: revoca el grant para invalidar sus refresh tokens. Es una
 *    segunda capa; si falla, el acceso a datos ya quedó cerrado en el paso 1.
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

  const { error } = await ctx.supabase.rpc("revoke_integration", { p_client_id: ctx.clientId });
  if (error) {
    const res = mapDbError(error);
    logApi({ route: ROUTE, status: res.status, startedAt, ...who });
    return res;
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

  logApi({
    route: ROUTE,
    status: 204,
    startedAt,
    ...who,
    note: grant?.ok ? "grant_revoked" : `grant_revoke_failed:${grant?.status ?? "network"}`,
  });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...rate.headers } });
}

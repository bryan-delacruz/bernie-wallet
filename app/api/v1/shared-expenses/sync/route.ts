import {
  authenticateClient,
  consumeRateLimit,
  logApi,
  mapDbError,
} from "@/lib/integrations/client-auth";
import { decodeCursor, readFrom } from "@/lib/integrations/cursor";
import { problem } from "@/lib/integrations/problem";
import { buildSyncPage, type ChangeRow } from "@/lib/integrations/sync-page";

export const runtime = "nodejs";

const ROUTE = "GET /api/v1/shared-expenses/sync";
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * Sync incremental de los gastos que el usuario comparte con la app que llama
 * (SPEC §15.6). Contrato: docs/api/openapi.json.
 */
export async function GET(request: Request) {
  const startedAt = Date.now();
  const respond = (res: Response, ctx?: { clientId: string; userId: string }) => {
    logApi({ route: ROUTE, status: res.status, startedAt, ...ctx });
    return res;
  };

  const ctx = await authenticateClient(request);
  if (ctx instanceof Response) return respond(ctx);
  const who = { clientId: ctx.clientId, userId: ctx.userId };

  const params = new URL(request.url).searchParams;
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return respond(problem("invalid_request", `limit must be an integer between 1 and ${MAX_LIMIT}`), who);
  }
  const rawCursor = params.get("cursor");
  const previous = rawCursor === null ? null : decodeCursor(rawCursor);
  if (rawCursor !== null && !previous) {
    return respond(problem("invalid_request", "cursor is malformed"), who);
  }

  const rate = await consumeRateLimit(ctx);
  if (rate instanceof Response) return respond(rate, who);

  const version = await ctx.supabase.rpc("integration_shares_version");
  if (version.error) return respond(mapDbError(version.error), who);

  const from = previous ? readFrom(previous) : null;
  const changes = await ctx.supabase.rpc("shared_expense_changes", {
    p_since_ts: from?.ts ?? null,
    p_since_id: from?.id ?? null,
    p_shares_version: previous?.sv ?? null,
    p_limit: limit + 1,
  });
  if (changes.error) return respond(mapDbError(changes.error), who);

  const page = buildSyncPage(changes.data as ChangeRow[], {
    limit,
    previous,
    sharesVersion: version.data as number,
    now: new Date(startedAt),
  });

  return respond(
    Response.json(page, { headers: { "Cache-Control": "no-store", ...rate.headers } }),
    who,
  );
}

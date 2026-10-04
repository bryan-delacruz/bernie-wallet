import { timingSafeEqual } from "node:crypto";
import { deliverPending } from "@/lib/integrations/webhook-delivery";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Entrega de respaldo de webhooks; la llama pg_cron cada minuto (SPEC §15.7). */
export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  try {
    const summary = await deliverPending(50);
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[webhooks] entrega de respaldo falló:", error instanceof Error ? error.message : error);
    return new Response(null, { status: 500 });
  }
}

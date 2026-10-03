import spec from "@/docs/api/openapi.json";

/** Contrato público de la API de apps conectadas (SPEC §15.6). */
export function GET() {
  return Response.json(spec, { headers: { "Cache-Control": "public, max-age=3600" } });
}

import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Respaldo de los datos de usuario, en JSON (SPEC §11.2).
 *
 * Lo llama un workflow de GitHub Actions cada noche, que cifra la respuesta antes
 * de guardarla. Se expone como endpoint —y no como un `pg_dump` desde fuera— para
 * que GitHub **no necesite credenciales de la base**: le basta el secreto interno
 * que ya existe. Si ese secreto se filtra, el daño es leer datos; con una
 * credencial de Postgres, sería escribirlos.
 *
 * **Qué incluye**: lo que el usuario no puede reconstruir — sus gastos y su
 * taxonomía.
 *
 * **Qué no**: los tokens de Google (son credenciales; tras una restauración el
 * usuario reconecta) y las tablas operativas de sync, que se regeneran solas. Un
 * respaldo que copia todo también multiplica lo que hay que proteger.
 */
const TABLES = [
  { name: "users", columns: "id, email, onboarded_at, week_starts_on, created_at" },
  { name: "user_banks", columns: "*" },
  { name: "payment_methods", columns: "*" },
  { name: "categories", columns: "*" },
  { name: "subcategories", columns: "*" },
  { name: "challenges", columns: "*" },
  { name: "expenses", columns: "*" },
] as const;

const PAGE = 1000;

function authorized(request: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Trae una tabla completa paginando: la API corta en `max_rows` sin avisar. */
async function dumpTable(
  admin: SupabaseClient,
  table: string,
  columns: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });

  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return new Response(null, { status: 503 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const data: Record<string, Record<string, unknown>[]> = {};
  try {
    for (const { name, columns } of TABLES) {
      data[name] = await dumpTable(admin, name, columns);
    }
  } catch (error) {
    // Conteos, nunca contenido.
    console.error("[backup] falló:", error instanceof Error ? error.message : "desconocido");
    return new Response(null, { status: 500 });
  }

  const counts = Object.fromEntries(Object.entries(data).map(([t, rows]) => [t, rows.length]));
  console.log(JSON.stringify({ event: "backup", ...counts }));

  return Response.json(
    { takenAt: new Date().toISOString(), counts, data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

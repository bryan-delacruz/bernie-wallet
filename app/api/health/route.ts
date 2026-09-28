import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Consulta mínima a la base. La llama un cron diario de Vercel para que el
 * proyecto gratuito de Supabase no se pause por inactividad (7 días).
 */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("system_banks").select("id").limit(1);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}

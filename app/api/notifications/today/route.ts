import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { loadStreakContext } from "@/lib/streak-data";
import { pickPhrase } from "@/lib/bernie-phrases";
import { reachedMilestone } from "@/lib/streak";
import { limaToday } from "@/lib/format";

export const runtime = "nodejs";

/**
 * La frase que Bernie dice hoy, para el usuario de la sesión.
 *
 * La pide el service worker cuando llega el push, que viaja vacío (SPEC §19.3).
 * Armarla acá y no al despachar tiene una ventaja: la racha y los pendientes son
 * los de este momento, no los de cuando el cron empujó el aviso.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const supabase = await createClient();
  const [context, { data: profile }] = await Promise.all([
    loadStreakContext(user.id),
    supabase.from("users").select("last_phrase_id").eq("id", user.id).maybeSingle(),
  ]);

  const today = limaToday();
  const phrase = pickPhrase(
    {
      // `getUTCDay` sobre el día de Lima ya resuelto: 0 = domingo.
      weekday: new Date(`${today}T00:00:00Z`).getUTCDay(),
      streakDays: context.streak.current,
      // Hito solo en el número exacto: a los 7, 30, 100… no todos los días después.
      milestone: reachedMilestone(context.streak.current) !== null,
      quietYesterday: context.daysWithoutSpending > 0,
      pendingExpenses: context.pendingExpenses,
    },
    // Semilla estable por usuario y día: si el aviso se reintenta, la frase no cambia.
    { seed: hashSeed(`${user.id}:${today}`), lastId: profile?.last_phrase_id ?? undefined },
  );

  // Se recuerda para no repetirla mañana. Si falla, el precio es una repetición.
  await supabase
    .from("users")
    .update({ last_phrase_id: phrase.id, last_notified_on: today })
    .eq("id", user.id);

  return NextResponse.json(
    { text: phrase.text },
    // Nunca cachear: es contenido de un usuario concreto.
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Hash chico y determinístico; solo necesita repartir, no resistir ataques. */
function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return hash;
}

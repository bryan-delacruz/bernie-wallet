import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { challengeProgress, type ChallengeProgress } from "@/lib/challenges";
import { limaToday } from "@/lib/format";

/** Reto activo del usuario con su progreso ya calculado. */
export type ActiveChallenge = ChallengeProgress & {
  id: string;
  /** Nombre de la categoría o subcategoría a la que apunta. Solo para la app:
   *  nunca viaja a una imagen compartible (SPEC §16.2). */
  targetLabel: string;
  startedOn: string;
};

const LIMA_TZ = "America/Lima";
const limaDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type ChallengeRow = {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
  target_days: number;
  started_on: string;
};

export const loadActiveChallenge = cache(async (userId: string): Promise<ActiveChallenge | null> => {
  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, category_id, subcategory_id, target_days, started_on")
    .eq("user_id", userId)
    .eq("outcome", "active")
    .maybeSingle<ChallengeRow>();
  if (!challenge) return null;

  // Un reto por categoría abarca todas sus subcategorías; uno por subcategoría,
  // solo esa.
  let subcategoryIds: string[];
  let targetLabel: string;
  if (challenge.subcategory_id) {
    const { data } = await supabase
      .from("subcategories")
      .select("name")
      .eq("id", challenge.subcategory_id)
      .maybeSingle();
    subcategoryIds = [challenge.subcategory_id];
    targetLabel = data?.name ?? "esa subcategoría";
  } else {
    const [{ data: subs }, { data: category }] = await Promise.all([
      supabase.from("subcategories").select("id").eq("category_id", challenge.category_id),
      supabase.from("categories").select("name").eq("id", challenge.category_id).maybeSingle(),
    ]);
    subcategoryIds = (subs ?? []).map((s) => s.id);
    targetLabel = category?.name ?? "esa categoría";
  }

  const today = limaToday();
  // Un reto sin subcategorías no puede tropezar: no hay gasto que lo rompa.
  const slipDays = subcategoryIds.length
    ? await loadSlipDays(supabase, userId, subcategoryIds, challenge.started_on)
    : [];

  return {
    id: challenge.id,
    targetLabel,
    startedOn: challenge.started_on,
    ...challengeProgress(
      { startedOn: challenge.started_on, targetDays: challenge.target_days },
      slipDays,
      today,
    ),
  };
});

async function loadSlipDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subcategoryIds: string[],
  startedOn: string,
): Promise<string[]> {
  const { rows } = await fetchAllRows<{ occurred_at: string }>((from, to) =>
    supabase
      .from("expenses")
      .select("occurred_at")
      .eq("user_id", userId)
      .in("subcategory_id", subcategoryIds)
      .gte("occurred_at", `${startedOn}T05:00:00.000Z`)
      .order("occurred_at", { ascending: false })
      .range(from, to),
  );
  return rows.map((r) => limaDayFmt.format(new Date(r.occurred_at)));
}

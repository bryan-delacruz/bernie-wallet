import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { computeStreak, noSpendStreak, type Streak, type StreakExpense } from "@/lib/streak";
import { achievementsFor, type Achievement } from "@/lib/achievements";
import { limaToday, shiftDay } from "@/lib/format";

/**
 * Datos de gamificación del usuario. Lo consumen el layout (para celebrar un
 * logro), el dashboard (para la tarjeta de racha) y la ruta que dibuja la imagen.
 * Va envuelto en `cache` para que las tres lecturas de un mismo request compartan
 * una sola consulta.
 */

const LIMA_TZ = "America/Lima";
const limaDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type StreakContext = {
  streak: Streak;
  daysWithoutSpending: number;
  totalExpenses: number;
  achievements: Achievement[];
  today: string;
};

type StreakRow = { occurred_at: string; created_at: string; subcategory_id: string | null };

export const loadStreakContext = cache(async (userId: string): Promise<StreakContext> => {
  const supabase = await createClient();
  const today = limaToday();
  // Un año: es lo que entra en la grilla y alcanza para todos los hitos de racha.
  const since = `${shiftDay(today, { days: 364 })}T05:00:00.000Z`;

  const [{ rows }, { count }] = await Promise.all([
    fetchAllRows<StreakRow>((from, to) =>
      supabase
        .from("expenses")
        .select("occurred_at, created_at, subcategory_id")
        .eq("user_id", userId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .range(from, to),
    ),
    // Solo el conteo: el hito de volumen no necesita las filas.
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const expenses: StreakExpense[] = rows.map((r) => ({
    day: limaDayFmt.format(new Date(r.occurred_at)),
    importedDay: limaDayFmt.format(new Date(r.created_at)),
    categorized: r.subcategory_id !== null,
  }));

  const streak = computeStreak(expenses, today);
  const totalExpenses = count ?? 0;

  return {
    streak,
    daysWithoutSpending: noSpendStreak(expenses, today),
    totalExpenses,
    achievements: achievementsFor({
      streak,
      totalExpenses,
      cleanMonth: lastCleanMonth(expenses, today),
    }),
    today,
  };
});

/** Último mes ya cerrado con gastos y sin ninguno sin categoría. El mes en curso
 *  no cuenta: todavía puede ensuciarse. */
function lastCleanMonth(expenses: StreakExpense[], today: string): string | null {
  const currentMonth = today.slice(0, 7);
  const months = new Map<string, { total: number; pending: number }>();
  for (const expense of expenses) {
    const month = expense.day.slice(0, 7);
    if (month >= currentMonth) continue;
    const entry = months.get(month) ?? { total: 0, pending: 0 };
    entry.total += 1;
    if (!expense.categorized) entry.pending += 1;
    months.set(month, entry);
  }
  const clean = [...months.entries()]
    .filter(([, m]) => m.total > 0 && m.pending === 0)
    .map(([month]) => month)
    .sort();
  return clean.at(-1) ?? null;
}

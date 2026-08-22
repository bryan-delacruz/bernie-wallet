import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { CategoryBars } from "@/components/dashboard/category-bars";
import { PaymentSplit } from "@/components/dashboard/payment-split";
import { MonthlyTrend } from "@/components/dashboard/monthly-trend";
import { formatCurrency, formatShortDate, limaMonthRange } from "@/lib/format";

const LIMA_TZ = "America/Lima";
const SECTION_TITLE = "text-sm font-semibold tracking-wide text-muted-foreground uppercase";
const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";

const PAYMENT_META: Record<string, { label: string; color: string }> = {
  credit_card: { label: "TC", color: "var(--chart-1)" },
  debit_card: { label: "TD", color: "var(--chart-2)" },
  yape: { label: "Yape", color: "var(--chart-3)" },
  account: { label: "Cuenta", color: "var(--chart-5)" },
};
const PAYMENT_ORDER = ["credit_card", "debit_card", "yape", "account", "none"];

const limaDayStartIso = (day: string) => `${day}T05:00:00.000Z`;
const limaDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const limaMonthFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TZ,
  year: "numeric",
  month: "2-digit",
});
const fmtDay = (day: string) => formatShortDate(`${day}T12:00:00Z`);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

type ExpenseRow = {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  occurred_at: string;
  source: "sync" | "manual";
  subcategory_id: string | null;
  payment_method_id: string | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; cat?: string; method?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const sp = await searchParams;
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const method = sp.method ?? "";
  const catIds = (sp.cat ?? "").split(",").filter(Boolean);
  const hasDateFilter = Boolean(from || to);
  const hasFilters = Boolean(from || to || method || catIds.length);

  // Fecha en Lima.
  const now = new Date();
  const nowParts = limaDayFmt.formatToParts(now);
  const curYear = Number(nowParts.find((p) => p.type === "year")!.value);
  const curMonth = Number(nowParts.find((p) => p.type === "month")!.value);
  const curDay = Number(nowParts.find((p) => p.type === "day")!.value);
  const todayLima = limaDayFmt.format(now);
  const daysInMonth = new Date(Date.UTC(curYear, curMonth, 0)).getUTCDate();

  const { startIso: monthStartIso, endIso: monthEndIso, label: monthLabel } = limaMonthRange(now);

  // Ventana del trend: últimos 6 meses (00:00 Lima del 1er día).
  const months = Array.from({ length: 6 }, (_, idx) => {
    const back = 5 - idx;
    const d = new Date(Date.UTC(curYear, curMonth - 1 - back, 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", month: "short" }).format(d),
      total: 0,
      current: back === 0,
    };
  });
  const trailingStartIso = new Date(Date.UTC(curYear, curMonth - 6, 1, 5)).toISOString();

  // Periodo del snapshot: rango de fechas si hay filtro, si no el mes actual.
  const periodStartIso = hasDateFilter ? (from ? limaDayStartIso(from) : undefined) : monthStartIso;
  let periodEndIso: string | undefined = hasDateFilter ? undefined : monthEndIso;
  if (hasDateFilter && to) {
    const n = new Date(limaDayStartIso(to));
    n.setUTCDate(n.getUTCDate() + 1); // "hasta" inclusive
    periodEndIso = n.toISOString();
  }

  // Referencia (para selects, join y filtro de categoría).
  const [{ data: subs }, { data: cats }, { data: methods }] = await Promise.all([
    supabase.from("subcategories").select("id, name, category_id").eq("user_id", user.id),
    supabase.from("categories").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("payment_methods").select("id, type").eq("user_id", user.id),
  ]);
  const subList = subs ?? [];
  const subIds = catIds.length
    ? subList.filter((s) => catIds.includes(s.category_id)).map((s) => s.id)
    : null;
  // Filtro por TIPO de medio (TC/TD/Yape/Cuenta) → ids de los medios de ese tipo.
  const methodIdsForType = method
    ? (methods ?? []).filter((m) => m.type === method).map((m) => m.id)
    : null;

  // Query del periodo (total, KPIs, desgloses, últimos) + query del trend (6 meses).
  let periodQuery = supabase
    .from("expenses")
    .select("id, merchant, amount, currency, occurred_at, source, subcategory_id, payment_method_id")
    .eq("user_id", user.id);
  if (periodStartIso) periodQuery = periodQuery.gte("occurred_at", periodStartIso);
  if (periodEndIso) periodQuery = periodQuery.lt("occurred_at", periodEndIso);
  if (methodIdsForType)
    periodQuery = periodQuery.in("payment_method_id", methodIdsForType.length ? methodIdsForType : [NO_MATCH_UUID]);
  if (subIds) periodQuery = periodQuery.in("subcategory_id", subIds.length ? subIds : [NO_MATCH_UUID]);

  let trendQuery = supabase
    .from("expenses")
    .select("amount, currency, occurred_at")
    .eq("user_id", user.id)
    .gte("occurred_at", trailingStartIso);
  if (methodIdsForType)
    trendQuery = trendQuery.in("payment_method_id", methodIdsForType.length ? methodIdsForType : [NO_MATCH_UUID]);
  if (subIds) trendQuery = trendQuery.in("subcategory_id", subIds.length ? subIds : [NO_MATCH_UUID]);

  const [{ data: periodRows }, { data: trendRows }] = await Promise.all([
    periodQuery.order("occurred_at", { ascending: false }).limit(1000),
    trendQuery,
  ]);

  const rows = (periodRows ?? []) as ExpenseRow[];

  // Totales por moneda (no mezclar). Principal = el primero.
  const byCurrency = new Map<string, number>();
  for (const r of rows) byCurrency.set(r.currency ?? "PEN", (byCurrency.get(r.currency ?? "PEN") ?? 0) + Number(r.amount));
  const order = ["PEN", "USD"];
  const rank = (c: string) => (order.indexOf(c) === -1 ? 99 : order.indexOf(c));
  const totals = [...byCurrency.entries()]
    .filter(([, a]) => a > 0)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([currency, total]) => ({ currency, total }));
  if (totals.length === 0) totals.push({ currency: "PEN", total: 0 });
  const cur = totals[0].currency;
  const periodTotal = totals[0].total;
  const primaryRows = rows.filter((r) => (r.currency ?? "PEN") === cur);

  // Desglose por categoría (top 5 + otros).
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const subToCat = new Map(subList.map((s) => [s.id, s.category_id as string]));
  const byCategory = new Map<string, number>();
  for (const r of primaryRows) {
    const catId = r.subcategory_id ? subToCat.get(r.subcategory_id) : null;
    const name = (catId && catName.get(catId)) || "Sin categoría";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(r.amount));
  }
  const sortedCats = [...byCategory.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
  const categoryItems =
    sortedCats.length > 6
      ? [...sortedCats.slice(0, 5), { label: "Otros", amount: sortedCats.slice(5).reduce((s, i) => s + i.amount, 0) }]
      : sortedCats;

  // Desglose por medio de pago.
  const methodType = new Map((methods ?? []).map((m) => [m.id, m.type as string]));
  const byMethod = new Map<string, number>();
  for (const r of primaryRows) {
    const type = r.payment_method_id ? methodType.get(r.payment_method_id) ?? "none" : "none";
    byMethod.set(type, (byMethod.get(type) ?? 0) + Number(r.amount));
  }
  const paymentItems = PAYMENT_ORDER.map((type) => ({ type, amount: byMethod.get(type) ?? 0 }))
    .filter((i) => i.amount > 0)
    .map((i) => ({
      label: PAYMENT_META[i.type]?.label ?? "Sin medio",
      amount: i.amount,
      color: PAYMENT_META[i.type]?.color ?? "var(--muted-foreground)",
    }));

  // Tendencia (6 meses, moneda principal, respeta categoría/medio; ignora el rango).
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const r of trendRows ?? []) {
    if ((r.currency ?? "PEN") !== cur) continue;
    const i = monthIndex.get(limaMonthFmt.format(new Date(r.occurred_at)).slice(0, 7));
    if (i !== undefined) months[i].total += Number(r.amount);
  }

  // KPIs + comparación (solo en modo mes actual).
  const movimientos = rows.length;
  const lo = from || (primaryRows.length ? limaDayFmt.format(new Date(primaryRows[primaryRows.length - 1].occurred_at)) : todayLima);
  const hi = to || todayLima;
  const periodDays = hasDateFilter ? Math.max(1, daysBetween(lo, hi) + 1) : Math.max(1, curDay);
  const dailyAvg = periodTotal / periodDays;

  let deltaPct: number | null = null;
  let statTiles: { label: string; value: string; hint?: string }[];
  if (hasDateFilter) {
    statTiles = [
      { label: "Movimientos", value: String(movimientos) },
      { label: "Prom. diario", value: formatCurrency(dailyAvg, cur) },
    ];
  } else {
    const prevTotal = months[4].total;
    deltaPct = prevTotal > 0 ? ((periodTotal - prevTotal) / prevTotal) * 100 : null;
    statTiles = [
      { label: "Prom. diario", value: formatCurrency(dailyAvg, cur) },
      { label: "Movimientos", value: String(movimientos) },
      { label: "Proyección", value: formatCurrency(dailyAvg * daysInMonth, cur), hint: "fin de mes" },
    ];
  }

  const periodLabel = !hasDateFilter
    ? monthLabel
    : from && to
      ? `${fmtDay(from)} – ${fmtDay(to)}`
      : from
        ? `Desde ${fmtDay(from)}`
        : `Hasta ${fmtDay(to)}`;

  const hasData = movimientos > 0;
  const hasTrend = months.some((m) => m.total > 0);
  const showFilters = hasData || hasFilters;
  const chartCount = (categoryItems.length > 0 ? 1 : 0) + (paymentItems.length > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-medium tracking-tight">Resumen</h1>

      {/* Hero: saldo + KPIs juntos en desktop. Sin datos, el saldo ocupa el ancho. */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BalanceCard
          monthLabel={periodLabel}
          totals={totals}
          deltaPct={deltaPct}
          className={hasData ? "lg:col-span-1" : "lg:col-span-3"}
        />
        {hasData && <StatTiles tiles={statTiles} className="lg:col-span-2" />}
      </section>

      {showFilters && (
        <DashboardFilters
          categories={(cats ?? []).map((c) => ({ id: c.id, label: c.name }))}
          methods={PAYMENT_ORDER.filter(
            (t) => t !== "none" && (methods ?? []).some((m) => m.type === t),
          ).map((t) => ({ id: t, label: PAYMENT_META[t].label }))}
        />
      )}

      {hasData ? (
        <>
          <div className={cn("grid grid-cols-1 gap-4", chartCount > 1 && "lg:grid-cols-2")}>
            {categoryItems.length > 0 && (
              <section className="space-y-3">
                <h2 className={SECTION_TITLE}>A dónde va tu plata</h2>
                <div className="rounded-xl border border-border bg-card p-4">
                  <CategoryBars items={categoryItems} currency={cur} />
                </div>
              </section>
            )}

            {paymentItems.length > 0 && (
              <section className="space-y-3">
                <h2 className={SECTION_TITLE}>Por medio de pago</h2>
                <div className="rounded-xl border border-border bg-card p-4">
                  <PaymentSplit items={paymentItems} currency={cur} />
                </div>
              </section>
            )}
          </div>

          {hasTrend && (
            <section className="space-y-3">
              <h2 className={SECTION_TITLE}>Tendencia · 6 meses</h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <MonthlyTrend months={months} currency={cur} />
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BarChart3 className="size-5" />
          </span>
          <p className="font-medium">
            {hasFilters ? "Sin resultados" : "Aún no hay datos que analizar"}
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {hasFilters
              ? "Ningún gasto coincide con estos filtros."
              : "Agrega o sincroniza tus gastos en Actividad y aquí verás tu resumen."}
          </p>
          {!hasFilters && (
            <Link href="/activity" className={cn(buttonVariants({ size: "sm" }), "mt-1")}>
              Ir a Actividad
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

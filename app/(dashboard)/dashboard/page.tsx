import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { CategoryBars } from "@/components/dashboard/category-bars";
import { PaymentSplit } from "@/components/dashboard/payment-split";
import { MonthlyTrend } from "@/components/dashboard/monthly-trend";
import { formatCurrency, formatShortDate, limaMonthRange } from "@/lib/format";

const LIMA_TZ = "America/Lima";
const SECTION_TITLE = "text-sm font-semibold tracking-wide text-muted-foreground uppercase";

// Medio de pago → etiqueta + color (tokens --chart-*), en orden fijo (categórico).
const PAYMENT_META: Record<string, { label: string; color: string }> = {
  credit_card: { label: "TC", color: "var(--chart-1)" },
  debit_card: { label: "TD", color: "var(--chart-2)" },
  yape: { label: "Yape", color: "var(--chart-3)" },
  account: { label: "Cuenta", color: "var(--chart-5)" },
};
const PAYMENT_ORDER = ["credit_card", "debit_card", "yape", "account", "none"];

type ExpenseRow = {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  occurred_at: string;
  source: "sync" | "manual";
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { startIso, endIso, label } = limaMonthRange(new Date());

  // Fecha en Lima (para KPIs y buckets del trend).
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const curYear = Number(nowParts.find((p) => p.type === "year")!.value);
  const curMonth = Number(nowParts.find((p) => p.type === "month")!.value); // 1-12
  const curDay = Number(nowParts.find((p) => p.type === "day")!.value);
  const daysInMonth = new Date(Date.UTC(curYear, curMonth, 0)).getUTCDate();

  // Últimos 6 meses (del más viejo al actual). 00:00 Lima del 1er día = 05:00 UTC.
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

  const [
    { data: monthRows },
    { data: trailingRows },
    { data: latest },
    { data: subs },
    { data: cats },
    { data: methods },
    { count: bankCount },
    { data: lastSync },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, currency, subcategory_id, payment_method_id")
      .eq("user_id", user.id)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso),
    supabase
      .from("expenses")
      .select("amount, currency, occurred_at")
      .eq("user_id", user.id)
      .gte("occurred_at", trailingStartIso),
    supabase
      .from("expenses")
      .select("id, merchant, amount, currency, occurred_at, source")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(8),
    supabase.from("subcategories").select("id, name, category_id").eq("user_id", user.id),
    supabase.from("categories").select("id, name").eq("user_id", user.id),
    supabase.from("payment_methods").select("id, type").eq("user_id", user.id),
    supabase.from("user_banks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("sync_logs")
      .select("created_at, last_sync_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Totales por moneda (no mezclar). PEN principal.
  const byCurrency = new Map<string, number>();
  for (const row of monthRows ?? []) {
    const c = row.currency ?? "PEN";
    byCurrency.set(c, (byCurrency.get(c) ?? 0) + Number(row.amount));
  }
  const order = ["PEN", "USD"];
  const rank = (c: string) => (order.indexOf(c) === -1 ? 99 : order.indexOf(c));
  const totals = [...byCurrency.entries()]
    .filter(([, a]) => a > 0)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([currency, total]) => ({ currency, total }));
  if (totals.length === 0) totals.push({ currency: "PEN", total: 0 });

  // Todos los desgloses van en la moneda principal (no mezclar PEN/USD).
  const cur = totals[0].currency;
  const currentTotal = totals[0].total;
  const primaryMonthRows = (monthRows ?? []).filter((r) => (r.currency ?? "PEN") === cur);

  // Desglose por categoría (top 5 + otros).
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const subToCat = new Map((subs ?? []).map((s) => [s.id, s.category_id as string]));
  const byCategory = new Map<string, number>();
  for (const r of primaryMonthRows) {
    const catId = r.subcategory_id ? subToCat.get(r.subcategory_id) : null;
    const name = (catId && catName.get(catId)) || "Sin categoría";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(r.amount));
  }
  const sortedCats = [...byCategory.entries()]
    .map(([labelName, amount]) => ({ label: labelName, amount }))
    .sort((a, b) => b.amount - a.amount);
  const categoryItems =
    sortedCats.length > 6
      ? [
          ...sortedCats.slice(0, 5),
          { label: "Otros", amount: sortedCats.slice(5).reduce((s, i) => s + i.amount, 0) },
        ]
      : sortedCats;

  // Desglose por medio de pago.
  const methodType = new Map((methods ?? []).map((m) => [m.id, m.type as string]));
  const byMethod = new Map<string, number>();
  for (const r of primaryMonthRows) {
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

  // Tendencia por mes (moneda principal); el mes actual usa el total exacto.
  const monthKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
  });
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const r of trailingRows ?? []) {
    if ((r.currency ?? "PEN") !== cur) continue;
    const key = monthKeyFmt.format(new Date(r.occurred_at)).slice(0, 7);
    const i = monthIndex.get(key);
    if (i !== undefined) months[i].total += Number(r.amount);
  }
  months[5].total = currentTotal; // consistencia con la tarjeta

  // KPIs + comparación mensual.
  const prevTotal = months[4].total;
  const deltaPct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;
  const dailyAvg = currentTotal / Math.max(1, curDay);
  const projection = dailyAvg * daysInMonth;
  const movimientos = (monthRows ?? []).length;

  const expenses = (latest ?? []) as ExpenseRow[];
  const hasBank = (bankCount ?? 0) > 0;
  const hasMonthData = movimientos > 0;
  const hasTrend = months.some((m) => m.total > 0);

  return (
    <div className="space-y-8">
      <BalanceCard monthLabel={label} totals={totals} deltaPct={deltaPct} />

      <DashboardActions
        hasBank={hasBank}
        lastSyncAt={lastSync?.created_at ?? null}
        coverageAt={lastSync?.last_sync_at ?? null}
      />

      {hasMonthData && (
        <>
          <StatTiles
            tiles={[
              { label: "Prom. diario", value: formatCurrency(dailyAvg, cur) },
              { label: "Movimientos", value: String(movimientos) },
              { label: "Proyección", value: formatCurrency(projection, cur), hint: "fin de mes" },
            ]}
          />

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
        </>
      )}

      {hasTrend && (
        <section className="space-y-3">
          <h2 className={SECTION_TITLE}>Tendencia · 6 meses</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <MonthlyTrend months={months} currency={cur} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>Últimos gastos</h2>
          {expenses.length > 0 && (
            <Link href="/activity" className="text-sm text-primary hover:underline">
              Ver todo
            </Link>
          )}
        </div>

        {expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ReceiptText className="size-5" />
            </span>
            <p className="font-medium">Aún no tienes gastos</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Agrega tu primer gasto a mano
              {hasBank ? " o sincroniza tu banco" : ""}. Aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{expense.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(expense.occurred_at)}
                    {expense.source === "manual" ? " · Manual" : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-expense">
                  − {formatCurrency(Number(expense.amount), expense.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

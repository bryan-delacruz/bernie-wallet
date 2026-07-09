import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { formatCurrency, formatShortDate, limaMonthRange } from "@/lib/format";

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
  // El layout ya garantiza sesión; este check es por seguridad de tipos.
  if (!user) return null;

  const { startIso, endIso, label } = limaMonthRange(new Date());

  const [{ data: monthRows }, { data: latest }, { count: bankCount }, { data: lastSync }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("amount, currency")
        .eq("user_id", user.id)
        .gte("occurred_at", startIso)
        .lt("occurred_at", endIso),
      supabase
        .from("expenses")
        .select("id, merchant, amount, currency, occurred_at, source")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(8),
      supabase.from("user_banks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("sync_logs")
        .select("created_at, last_sync_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Totales por moneda (no mezclar PEN y USD). PEN va primero como principal.
  const byCurrency = new Map<string, number>();
  for (const row of monthRows ?? []) {
    const cur = row.currency ?? "PEN";
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + Number(row.amount));
  }
  const currencyOrder = ["PEN", "USD"];
  const rank = (c: string) => {
    const i = currencyOrder.indexOf(c);
    return i === -1 ? 99 : i;
  };
  const totals = [...byCurrency.entries()]
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([currency, total]) => ({ currency, total }));
  if (totals.length === 0) totals.push({ currency: "PEN", total: 0 });

  const expenses = (latest ?? []) as ExpenseRow[];
  const hasBank = (bankCount ?? 0) > 0;
  const lastSyncAt = lastSync?.created_at ?? null;
  const coverageAt = lastSync?.last_sync_at ?? null;

  return (
    <div className="space-y-8">
      <BalanceCard monthLabel={label} totals={totals} />

      <DashboardActions hasBank={hasBank} lastSyncAt={lastSyncAt} coverageAt={coverageAt} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Últimos gastos
          </h2>
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

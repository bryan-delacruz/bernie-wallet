import { ReceiptText, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddExpenseDialog } from "@/components/dashboard/add-expense-dialog";
import { ActivityFilters } from "@/components/dashboard/activity-filters";
import { ExpenseList, type ExpenseRow } from "@/components/dashboard/expense-list";
import type { CategoryOption, PaymentMethodOption } from "@/components/dashboard/expense-form";

const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";

// Un día "YYYY-MM-DD" a las 00:00 de Lima (UTC-5) como instante UTC.
function limaDayStartIso(day: string): string {
  return `${day}T05:00:00.000Z`;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; cat?: string; method?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const method = sp.method ?? "";
  const catIds = (sp.cat ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hasFilters = Boolean(q || from || to || method || catIds.length);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Datos de referencia (selects + join). Pequeños y en paralelo.
  const [{ data: subs }, { data: methods }, { data: cats }] = await Promise.all([
    supabase.from("subcategories").select("id, name, category_id").eq("user_id", user.id),
    supabase.from("payment_methods").select("id, type, identifier, alias").eq("user_id", user.id),
    supabase.from("categories").select("id, name").eq("user_id", user.id).order("name"),
  ]);
  const subList = subs ?? [];

  // Gastos con filtros server-side (funciona más allá del tope y URLs compartibles).
  let query = supabase
    .from("expenses")
    .select("id, merchant, amount, currency, occurred_at, source, subcategory_id, payment_method_id")
    .eq("user_id", user.id);

  if (q) query = query.ilike("merchant", `%${q}%`);
  if (from) query = query.gte("occurred_at", limaDayStartIso(from));
  if (to) {
    const next = new Date(limaDayStartIso(to));
    next.setUTCDate(next.getUTCDate() + 1); // "hasta" inclusive
    query = query.lt("occurred_at", next.toISOString());
  }
  if (method) query = query.eq("payment_method_id", method);
  if (catIds.length) {
    const subIds = subList.filter((s) => catIds.includes(s.category_id)).map((s) => s.id);
    query = query.in("subcategory_id", subIds.length ? subIds : [NO_MATCH_UUID]);
  }

  const { data: rawExpenses } = await query
    .order("occurred_at", { ascending: false })
    .limit(200);

  const subById = new Map(subList.map((s) => [s.id, s]));
  const methodById = new Map((methods ?? []).map((m) => [m.id, m]));

  const rows: ExpenseRow[] = (rawExpenses ?? []).map((e) => {
    const sub = e.subcategory_id ? subById.get(e.subcategory_id) : undefined;
    const pm = e.payment_method_id ? methodById.get(e.payment_method_id) : undefined;
    return {
      id: e.id,
      merchant: e.merchant,
      amount: e.amount,
      currency: e.currency,
      occurred_at: e.occurred_at,
      source: e.source,
      subcategory_id: e.subcategory_id,
      payment_method_id: e.payment_method_id,
      subcategories: sub ? { name: sub.name, category_id: sub.category_id } : null,
      payment_methods: pm ? { type: pm.type, identifier: pm.identifier } : null,
    };
  });

  const categoryOptions: CategoryOption[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: subList
      .filter((s) => s.category_id === c.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }));

  const paymentMethodOptions: PaymentMethodOption[] = (methods ?? []).map((m) => ({
    id: m.id,
    label: m.alias ?? `${TIPO_LABEL[m.type] ?? m.type} ${m.identifier}`,
  }));

  // Filtros visibles si hay gastos o hay un filtro activo (no en cuenta vacía).
  const showFilters = rows.length > 0 || hasFilters;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Actividad</h1>
        <AddExpenseDialog categories={categoryOptions} paymentMethods={paymentMethodOptions} />
      </div>

      {showFilters && (
        <ActivityFilters
          categories={categoryOptions.map((c) => ({ id: c.id, label: c.name }))}
          methods={paymentMethodOptions}
        />
      )}

      {rows.length === 0 ? (
        hasFilters ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">Sin resultados</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ningún gasto coincide con esos filtros. Prueba con otros.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ReceiptText className="size-5" />
            </span>
            <p className="font-medium">Aún no tienes gastos</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Usa “Agregar gasto” para registrar tu primer movimiento a mano.
            </p>
          </div>
        )
      ) : (
        <ExpenseList
          expenses={rows}
          categories={categoryOptions}
          paymentMethods={paymentMethodOptions}
        />
      )}
    </div>
  );
}

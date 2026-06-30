import { ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddExpenseDialog } from "@/components/dashboard/add-expense-dialog";
import { ExpenseList, type ExpenseRow } from "@/components/dashboard/expense-list";
import type {
  CategoryOption,
  PaymentMethodOption,
} from "@/components/dashboard/expense-form";

const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Consultas planas (sin joins embebidos) + unión en JS, más robusto.
  const [{ data: rawExpenses }, { data: subs }, { data: methods }, { data: cats }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select(
          "id, merchant, amount, currency, occurred_at, source, subcategory_id, payment_method_id",
        )
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(200),
      supabase.from("subcategories").select("id, name, category_id").eq("user_id", user.id),
      supabase
        .from("payment_methods")
        .select("id, type, identifier, alias")
        .eq("user_id", user.id),
      supabase.from("categories").select("id, name").eq("user_id", user.id).order("name"),
    ]);

  const subList = subs ?? [];
  const subById = new Map(subList.map((s) => [s.id, s]));
  const methodById = new Map((methods ?? []).map((m) => [m.id, m]));

  const rows: ExpenseRow[] = (rawExpenses ?? []).map((e) => {
    const sub = e.subcategory_id ? subById.get(e.subcategory_id) : undefined;
    const method = e.payment_method_id ? methodById.get(e.payment_method_id) : undefined;
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
      payment_methods: method ? { type: method.type, identifier: method.identifier } : null,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Actividad</h1>
        <AddExpenseDialog categories={categoryOptions} paymentMethods={paymentMethodOptions} />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ReceiptText className="size-5" />
          </span>
          <p className="font-medium">Aún no tienes gastos</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Usa “Agregar gasto” para registrar tu primer movimiento a mano.
          </p>
        </div>
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

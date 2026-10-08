import Link from "next/link";
import { ArrowLeft, PartyPopper } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { loadCategorizationQueue } from "@/lib/categorize/queue";
import {
  CategorizeQueue,
  type SubcategoryLabels,
} from "@/components/dashboard/categorize-queue";
import type { CategoryOption } from "@/components/dashboard/expense-form";

export const metadata = { title: "Ordenar pendientes" };

export default async function CategorizePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [queue, { data: cats }, { data: subs }] = await Promise.all([
    loadCategorizationQueue(user.id),
    supabase.from("categories").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("subcategories").select("id, name, category_id").eq("user_id", user.id),
  ]);

  const subList = subs ?? [];
  const catNameById = new Map((cats ?? []).map((c) => [c.id, c.name]));

  const categories: CategoryOption[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: subList
      .filter((s) => s.category_id === c.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }));

  // Índice para pintar la sugerencia sin que el cliente recorra la taxonomía.
  const subcategoryLabels: SubcategoryLabels = Object.fromEntries(
    subList.map((s) => [
      s.id,
      { name: s.name, categoryName: catNameById.get(s.category_id) ?? "" },
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/activity"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Actividad
        </Link>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Ordenar pendientes</h1>
        {queue.pendingExpenses > 0 ? (
          <p className="text-sm text-muted-foreground">
            {queue.pendingExpenses} gastos esperan categoría, y se repiten entre{" "}
            {queue.groups.length} {queue.groups.length === 1 ? "comercio" : "comercios"}.
            Decide por comercio y Bernie lo aplica a todos sus gastos — también a los que
            lleguen después.
          </p>
        ) : null}
      </div>

      {queue.truncated && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          La cola es muy larga y se leyó incompleta. Ordena lo que ves y vuelve a entrar.
        </p>
      )}

      {queue.groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PartyPopper className="size-5" />
          </span>
          <p className="font-medium">Nada pendiente</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {queue.withoutMerchant > 0
              ? `Quedan ${queue.withoutMerchant} gastos sin comercio: esos se editan uno a uno desde Actividad.`
              : "Todos tus gastos tienen categoría. Guau."}
          </p>
        </div>
      ) : (
        <CategorizeQueue
          groups={queue.groups}
          categories={categories}
          subcategoryLabels={subcategoryLabels}
          withoutMerchant={queue.withoutMerchant}
        />
      )}
    </div>
  );
}

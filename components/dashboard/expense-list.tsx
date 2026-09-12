"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExpenseForm,
  type CategoryOption,
  type PaymentMethodOption,
} from "@/components/dashboard/expense-form";
import { createExpense, updateExpense, deleteExpense } from "@/app/(dashboard)/activity/actions";
import { formatCurrency, formatShortDate, toLimaDateInput } from "@/lib/format";

const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

export type ExpenseRow = {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  occurred_at: string;
  source: "sync" | "manual";
  subcategory_id: string | null;
  payment_method_id: string | null;
  subcategories: { name: string; category_id: string } | null;
  payment_methods: { type: string; identifier: string } | null;
};

export function ExpenseList({
  expenses,
  categories,
  paymentMethods,
}: {
  expenses: ExpenseRow[];
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [duplicating, setDuplicating] = useState<ExpenseRow | null>(null);

  return (
    <>
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {expenses.map((expense) => (
          <li key={expense.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setEditing(expense)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{expense.merchant}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatShortDate(expense.occurred_at)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {expense.subcategories?.name ?? "Sin categoría"}
                  </span>
                  {expense.payment_methods && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                      {TIPO_LABEL[expense.payment_methods.type] ?? expense.payment_methods.type}{" "}
                      {expense.payment_methods.identifier}
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {expense.source === "sync" ? "Sync" : "Manual"}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-expense">
                − {formatCurrency(Number(expense.amount), expense.currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">Editar gasto</DialogTitle>
            <DialogDescription>Modifica los datos o elimina el gasto.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ExpenseForm
              key={editing.id}
              categories={categories}
              paymentMethods={paymentMethods}
              initial={{
                amount: Number(editing.amount),
                currency: editing.currency,
                merchant: editing.merchant,
                date: toLimaDateInput(editing.occurred_at),
                categoryId: editing.subcategories?.category_id ?? "",
                subcategoryId: editing.subcategory_id ?? "",
                paymentMethodId: editing.payment_method_id ?? "",
              }}
              action={(formData) => updateExpense(editing.id, formData)}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
              submitLabel="Guardar cambios"
              deleteSlot={
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const exp = editing;
                      setEditing(null);
                      setDuplicating(exp);
                    }}
                  >
                    <Copy className="size-4" />
                    Duplicar
                  </Button>
                  <DeleteExpenseButton id={editing.id} onDone={() => setEditing(null)} />
                </div>
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!duplicating}
        onOpenChange={(o) => {
          if (!o) setDuplicating(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">Duplicar gasto</DialogTitle>
            <DialogDescription>
              Se crea un gasto nuevo con estos datos (fecha de hoy). Ajusta lo que necesites.
            </DialogDescription>
          </DialogHeader>
          {duplicating && (
            <ExpenseForm
              key={`dup-${duplicating.id}`}
              categories={categories}
              paymentMethods={paymentMethods}
              initial={{
                amount: Number(duplicating.amount),
                currency: duplicating.currency,
                merchant: duplicating.merchant,
                date: toLimaDateInput(new Date().toISOString()),
                categoryId: duplicating.subcategories?.category_id ?? "",
                subcategoryId: duplicating.subcategory_id ?? "",
                paymentMethodId: duplicating.payment_method_id ?? "",
              }}
              action={createExpense}
              onDone={() => setDuplicating(null)}
              onCancel={() => setDuplicating(null)}
              submitLabel="Agregar gasto"
              successMessage="Gasto agregado"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteExpenseButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      className="text-expense hover:text-expense"
      onClick={() => {
        if (!confirm("¿Eliminar este gasto?")) return;
        startTransition(async () => {
          const res = await deleteExpense(id);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Gasto eliminado");
          onDone();
        });
      }}
    >
      <Trash2 className="size-4" />
      Eliminar
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { createExpense } from "@/app/(dashboard)/activity/actions";

export type { CategoryOption };

export function AddExpenseDialog({
  categories,
  paymentMethods,
}: {
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" className="h-11 text-sm">
        <Plus className="size-4" />
        Agregar gasto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">Nuevo gasto</DialogTitle>
            <DialogDescription>
              Registra un gasto a mano. Aparecerá en tu actividad al instante.
            </DialogDescription>
          </DialogHeader>

          {open && (
            <ExpenseForm
              categories={categories}
              paymentMethods={paymentMethods}
              action={createExpense}
              onDone={() => setOpen(false)}
              onCancel={() => setOpen(false)}
              submitLabel="Guardar gasto"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

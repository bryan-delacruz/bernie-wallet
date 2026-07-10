"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";

export type CategoryOption = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

export type PaymentMethodOption = { id: string; label: string };

export type ExpenseInitial = {
  amount: number;
  currency: string;
  merchant: string;
  date: string; // YYYY-MM-DD
  categoryId: string;
  subcategoryId: string;
  paymentMethodId: string;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type ExpenseFormProps = {
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
  initial?: ExpenseInitial;
  action: (formData: FormData) => Promise<{ error?: string }>;
  onDone: () => void;
  onCancel: () => void;
  submitLabel: string;
  deleteSlot?: ReactNode;
};

export function ExpenseForm({
  categories,
  paymentMethods,
  initial,
  action,
  onDone,
  onCancel,
  submitLabel,
  deleteSlot,
}: ExpenseFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcategories =
    categories.find((c) => c.id === categoryId)?.subcategories ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await action(new FormData(e.currentTarget));
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast.success(initial ? "Gasto actualizado" : "Gasto agregado");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={initial?.amount}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Moneda</Label>
          <select
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? "PEN"}
            className={SELECT_CLASS}
          >
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="merchant">Comercio o beneficiario</Label>
        <Input
          id="merchant"
          name="merchant"
          placeholder="Ej. Plaza Vea"
          defaultValue={initial?.merchant}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={initial?.date ?? todayLocal()}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoría</Label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subcategory">Subcategoría</Label>
          <select
            id="subcategory"
            name="subcategoryId"
            defaultValue={initial?.subcategoryId ?? ""}
            className={SELECT_CLASS}
            disabled={subcategories.length === 0}
          >
            <option value="">{subcategories.length ? "Sin especificar" : "—"}</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {paymentMethods.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="paymentMethod">Medio de pago</Label>
          <select
            id="paymentMethod"
            name="paymentMethodId"
            defaultValue={initial?.paymentMethodId ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">Sin medio</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-expense">{error}</p>}

      <DialogFooter className="gap-2 sm:justify-between">
        {deleteSlot ?? <span />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : submitLabel}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

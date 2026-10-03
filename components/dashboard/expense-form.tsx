"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
  CreatableCombobox,
  NO_SELECTION,
  type ComboboxValue,
} from "@/components/ui/creatable-combobox";

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

/** Valor inicial del combobox a partir del id guardado en el gasto. */
function toInitialValue(
  options: { id: string; name: string }[],
  id: string | undefined,
): ComboboxValue {
  const found = id ? options.find((o) => o.id === id) : undefined;
  return found ? { kind: "existing", id: found.id, name: found.name } : NO_SELECTION;
}

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
  /** Mensaje de éxito. Por defecto según `initial` (editar vs. agregar); útil para
   *  el duplicado, que lleva `initial` pero es una creación. */
  successMessage?: string;
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
  successMessage,
}: ExpenseFormProps) {
  const [category, setCategory] = useState<ComboboxValue>(() =>
    toInitialValue(categories, initial?.categoryId),
  );
  const [subcategory, setSubcategory] = useState<ComboboxValue>(() =>
    toInitialValue(
      categories.find((c) => c.id === initial?.categoryId)?.subcategories ?? [],
      initial?.subcategoryId,
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opciones estables: el combobox memoiza su lista filtrada a partir de ellas,
  // así que un array nuevo por render invalidaría esa memo en cada tecla.
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name })),
    [categories],
  );
  const subcategories = useMemo(
    () =>
      category.kind === "existing"
        ? (categories.find((c) => c.id === category.id)?.subcategories ?? [])
        : [],
    [categories, category],
  );

  // Cambiar de categoría invalida la subcategoría elegida: pertenece a la anterior.
  function onCategoryChange(next: ComboboxValue) {
    setCategory(next);
    setSubcategory(NO_SELECTION);
  }

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
    toast.success(successMessage ?? (initial ? "Gasto actualizado" : "Gasto agregado"));
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoría</Label>
          <CreatableCombobox
            id="category"
            options={categoryOptions}
            value={category}
            onValueChange={onCategoryChange}
            placeholder="Sin categoría"
            emptyMessage="Escribe para crear una"
          />
          {category.kind === "existing" && (
            <input type="hidden" name="categoryId" value={category.id} />
          )}
          {category.kind === "new" && (
            <input type="hidden" name="categoryName" value={category.name} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subcategory">Subcategoría</Label>
          <CreatableCombobox
            id="subcategory"
            options={subcategories}
            value={subcategory}
            onValueChange={setSubcategory}
            placeholder={category.kind === "none" ? "Elige categoría" : "Sin especificar"}
            emptyMessage="Escribe para crear una"
            disabled={category.kind === "none"}
          />
          {subcategory.kind === "existing" && (
            <input type="hidden" name="subcategoryId" value={subcategory.id} />
          )}
          {subcategory.kind === "new" && (
            <input type="hidden" name="subcategoryName" value={subcategory.name} />
          )}
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

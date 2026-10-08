"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CreatableCombobox,
  NO_SELECTION,
  type ComboboxValue,
} from "@/components/ui/creatable-combobox";
import type { CategoryOption } from "@/components/dashboard/expense-form";
import { categorizeBulk, applyAllSuggestions } from "@/app/(dashboard)/categorize/actions";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { Taxonomy } from "@/lib/taxonomy";

/** Grupos visibles al entrar, y cuántos agrega cada "Ver más". El trabajo útil
 *  está en la cabecera de la lista: los grupos van ordenados por cantidad. */
const PAGE = 20;

export type QueueGroup = {
  key: string;
  label: string;
  expenseIds: string[];
  count: number;
  totals: { currency: string; amount: number }[];
  firstAt: string;
  lastAt: string;
  suggestedSubcategoryId: string | null;
};

/** `subcategory_id → etiqueta legible`, para pintar la sugerencia. */
export type SubcategoryLabels = Record<string, { name: string; categoryName: string }>;

export function CategorizeQueue({
  groups,
  categories,
  subcategoryLabels,
  withoutMerchant,
}: {
  groups: QueueGroup[];
  categories: CategoryOption[];
  subcategoryLabels: SubcategoryLabels;
  withoutMerchant: number;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(PAGE);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [applyingAll, startApplyAll] = useTransition();

  const suggested = useMemo(
    () => groups.filter((g) => g.suggestedSubcategoryId && subcategoryLabels[g.suggestedSubcategoryId]),
    [groups, subcategoryLabels],
  );
  const suggestedExpenses = useMemo(
    () => suggested.reduce((acc, g) => acc + g.count, 0),
    [suggested],
  );

  function onApplyAll() {
    startApplyAll(async () => {
      const result = await applyAllSuggestions();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.updated} gastos categorizados`);
      // `revalidatePath` invalida el caché del servidor; este refresh es el que
      // vuelve a pedir la página para que la lista se vacíe sin recargar a mano.
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {suggested.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm">
              Bernie ya sabe dónde van{" "}
              <span className="font-medium">{suggestedExpenses} gastos</span> de{" "}
              {suggested.length} {suggested.length === 1 ? "comercio" : "comercios"}, porque
              ya los categorizaste antes.
            </p>
          </div>
          <Button onClick={onApplyAll} disabled={applyingAll} className="shrink-0">
            {applyingAll ? "Aplicando…" : "Aplicar todas"}
          </Button>
        </div>
      )}

      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {groups.slice(0, visible).map((group) => (
          <li key={group.key} className="border-b border-border last:border-b-0">
            <GroupRow
              group={group}
              categories={categories}
              suggestionLabel={
                group.suggestedSubcategoryId
                  ? subcategoryLabels[group.suggestedSubcategoryId]
                  : undefined
              }
              open={openKey === group.key}
              busy={busyKey === group.key}
              disabled={applyingAll || (busyKey !== null && busyKey !== group.key)}
              onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
              onBusyChange={(busy) => setBusyKey(busy ? group.key : null)}
              onSaved={() => {
                setOpenKey(null);
                router.refresh();
              }}
            />
          </li>
        ))}
      </ul>

      {visible < groups.length && (
        <Button variant="outline" className="w-full" onClick={() => setVisible(visible + PAGE)}>
          Ver más ({groups.length - visible})
        </Button>
      )}

      {withoutMerchant > 0 && (
        <p className="text-xs text-muted-foreground">
          {withoutMerchant} {withoutMerchant === 1 ? "gasto no tiene" : "gastos no tienen"}{" "}
          comercio, así que no se pueden agrupar. Esos se editan desde Actividad.
        </p>
      )}
    </div>
  );
}

function GroupRow({
  group,
  categories,
  suggestionLabel,
  open,
  busy,
  disabled,
  onToggle,
  onBusyChange,
  onSaved,
}: {
  group: QueueGroup;
  categories: CategoryOption[];
  suggestionLabel?: { name: string; categoryName: string };
  open: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => void;
}) {
  async function save(taxonomy: Taxonomy) {
    onBusyChange(true);
    const result = await categorizeBulk(group.expenseIds, taxonomy);
    onBusyChange(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.updated} ${result.updated === 1 ? "gasto" : "gastos"} de ${group.label} categorizados`,
    );
    onSaved();
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{group.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {group.count} {group.count === 1 ? "gasto" : "gastos"} ·{" "}
            {group.totals.map((t) => formatCurrency(t.amount, t.currency)).join(" + ")} ·{" "}
            {group.firstAt === group.lastAt
              ? formatShortDate(group.lastAt)
              : `${formatShortDate(group.firstAt)} – ${formatShortDate(group.lastAt)}`}
          </p>
        </div>

        {suggestionLabel && !open ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || disabled}
            onClick={() =>
              save({
                categoryId: null,
                categoryName: null,
                subcategoryId: group.suggestedSubcategoryId,
                subcategoryName: null,
              })
            }
            className="shrink-0"
          >
            <Check className="size-4" />
            {suggestionLabel.name}
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={onToggle}
          disabled={busy || disabled}
          className="shrink-0"
        >
          <Tag className="size-4" />
          {open ? "Cerrar" : "Otra"}
        </Button>
      </div>

      {open && (
        <GroupPicker
          categories={categories}
          count={group.count}
          busy={busy}
          onSave={save}
        />
      )}
    </div>
  );
}

function GroupPicker({
  categories,
  count,
  busy,
  onSave,
}: {
  categories: CategoryOption[];
  count: number;
  busy: boolean;
  onSave: (taxonomy: Taxonomy) => void;
}) {
  const [category, setCategory] = useState<ComboboxValue>(NO_SELECTION);
  const [subcategory, setSubcategory] = useState<ComboboxValue>(NO_SELECTION);

  // Opciones estables: el combobox memoiza su lista filtrada a partir de ellas.
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

  const ready = subcategory.kind !== "none";

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <CreatableCombobox
            options={categoryOptions}
            value={category}
            onValueChange={onCategoryChange}
            placeholder="Elige una"
            emptyMessage="Escribe para crear una"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Subcategoría</Label>
          <CreatableCombobox
            options={subcategories}
            value={subcategory}
            onValueChange={setSubcategory}
            placeholder={category.kind === "none" ? "Elige categoría" : "Elige una"}
            emptyMessage="Escribe para crear una"
            disabled={category.kind === "none"}
          />
        </div>
      </div>

      <Button
        className="w-full"
        disabled={!ready || busy}
        onClick={() =>
          onSave({
            categoryId: category.kind === "existing" ? category.id : null,
            categoryName: category.kind === "new" ? category.name : null,
            subcategoryId: subcategory.kind === "existing" ? subcategory.id : null,
            subcategoryName: subcategory.kind === "new" ? subcategory.name : null,
          })
        }
      >
        {busy ? "Guardando…" : `Aplicar a ${count} ${count === 1 ? "gasto" : "gastos"}`}
      </Button>
    </div>
  );
}

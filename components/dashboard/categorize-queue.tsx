"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Sparkles, Tag, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CreatableCombobox,
  NO_SELECTION,
  type ComboboxValue,
} from "@/components/ui/creatable-combobox";
import type { CategoryOption } from "@/components/dashboard/expense-form";
import {
  categorizeBulk,
  applyAllSuggestions,
  setMerchantMuted,
} from "@/app/(dashboard)/categorize/actions";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MIN_GROUP_SIZE, type PendingExpense, type Suggestion } from "@/lib/categorize/merchant";
import type { Taxonomy } from "@/lib/taxonomy";

/** Grupos visibles al entrar, y cuántos agrega cada "Ver más". El trabajo útil
 *  está en la cabecera de la lista: los grupos van ordenados por cantidad. */
const PAGE = 20;

export type QueueGroup = {
  key: string;
  label: string;
  expenses: PendingExpense[];
  count: number;
  totals: { currency: string; amount: number }[];
  firstAt: string;
  lastAt: string;
  suggestion: Suggestion;
};

/** `subcategory_id → etiqueta legible`, para nombrar lo que la app sugiere. */
export type SubcategoryLabels = Record<string, { name: string; categoryName: string }>;

/** La sugerencia es accionable de un toque solo cuando la app puede afirmarla. */
function actionableSubcategory(suggestion: Suggestion): string | null {
  return suggestion.kind === "memory" || suggestion.kind === "pinned"
    ? suggestion.subcategoryId
    : null;
}

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
  // Arranca por los comercios que más se repiten: ahí está casi todo el ahorro.
  const [onlyRepeated, setOnlyRepeated] = useState(true);
  const [visible, setVisible] = useState(PAGE);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [applyingAll, startApplyAll] = useTransition();

  const shown = useMemo(
    () => (onlyRepeated ? groups.filter((g) => g.count >= MIN_GROUP_SIZE) : groups),
    [groups, onlyRepeated],
  );

  const suggested = useMemo(
    () =>
      shown.filter((g) => {
        const id = actionableSubcategory(g.suggestion);
        return id !== null && subcategoryLabels[id];
      }),
    [shown, subcategoryLabels],
  );
  const suggestedExpenses = useMemo(
    () => suggested.reduce((acc, g) => acc + g.count, 0),
    [suggested],
  );

  function onApplyAll() {
    startApplyAll(async () => {
      const result = await applyAllSuggestions(onlyRepeated ? MIN_GROUP_SIZE : 1);
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

      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {[
          { value: true, label: `${MIN_GROUP_SIZE} o más` },
          { value: false, label: "Todos" },
        ].map(({ value, label }) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={onlyRepeated === value}
            onClick={() => {
              setOnlyRepeated(value);
              setVisible(PAGE);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              onlyRepeated === value
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="ml-1.5 tabular-nums opacity-60">
              {value
                ? groups.filter((g) => g.count >= MIN_GROUP_SIZE).length
                : groups.length}
            </span>
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {shown.slice(0, visible).map((group) => (
          <li key={group.key} className="border-b border-border last:border-b-0">
            <GroupRow
              group={group}
              categories={categories}
              subcategoryLabels={subcategoryLabels}
              open={openKey === group.key}
              busy={busyKey === group.key}
              disabled={applyingAll || (busyKey !== null && busyKey !== group.key)}
              onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
              onBusyChange={(busy) => setBusyKey(busy ? group.key : null)}
              onSaved={() => {
                setOpenKey(null);
                router.refresh();
              }}
              onRuleChanged={() => router.refresh()}
            />
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Ningún comercio llega a {MIN_GROUP_SIZE} gastos. Mirá “Todos” para
          resolverlos de a uno.
        </p>
      )}

      {visible < shown.length && (
        <Button variant="outline" className="w-full" onClick={() => setVisible(visible + PAGE)}>
          Ver más ({shown.length - visible})
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
  subcategoryLabels,
  open,
  busy,
  disabled,
  onToggle,
  onBusyChange,
  onSaved,
  onRuleChanged,
}: {
  group: QueueGroup;
  categories: CategoryOption[];
  subcategoryLabels: SubcategoryLabels;
  open: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => void;
  onRuleChanged: () => void;
}) {
  const [savingRule, startSaveRule] = useTransition();
  /** Gasto que se está categorizando solo, en un comercio sin agrupar. */
  const [singleId, setSingleId] = useState<string | null>(null);

  const muted = group.suggestion.kind === "muted";
  const suggestedId = actionableSubcategory(group.suggestion);
  const suggestionLabel = suggestedId ? subcategoryLabels[suggestedId] : undefined;

  /** Aplica a `ids`; sin argumento, a todo el grupo. */
  async function save(taxonomy: Taxonomy, ids?: string[]) {
    const target = ids ?? group.expenses.map((e) => e.id);
    onBusyChange(true);
    const result = await categorizeBulk(target, taxonomy);
    onBusyChange(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.updated} ${result.updated === 1 ? "gasto" : "gastos"} de ${group.label} categorizados`,
    );
    setSingleId(null);
    onSaved();
  }

  function toggleRule() {
    startSaveRule(async () => {
      const result = await setMerchantMuted(group.key, !muted);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        muted
          ? `Bernie vuelve a agrupar ${group.label}`
          : `${group.label} se categoriza de a uno`,
      );
      onRuleChanged();
    });
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

        {suggestionLabel && !open && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || disabled}
            onClick={() =>
              save({
                categoryId: null,
                categoryName: null,
                subcategoryId: suggestedId,
                subcategoryName: null,
              })
            }
            className="shrink-0"
          >
            <Check className="size-4" />
            {suggestionLabel.name}
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={onToggle}
          disabled={busy || disabled}
          className="shrink-0"
        >
          {muted ? <ChevronDown className="size-4" /> : <Tag className="size-4" />}
          {open ? "Cerrar" : muted ? "Ver gastos" : suggestionLabel ? "Otra" : "Elegir"}
        </Button>
      </div>

      {/* Por qué no hay un botón de un toque: el historial de este comercio se
          contradice, así que la moda no es una respuesta. */}
      {group.suggestion.kind === "varies" && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {/* Con un solo antecedente no hay nada entre qué variar: decirlo como
              "varía entre X" sonaría a error. */}
          {group.suggestion.options.length > 1
            ? `Varía entre ${group.suggestion.options
                .slice(0, 3)
                .map((id) => subcategoryLabels[id]?.name)
                .filter(Boolean)
                .join(", ")}. Bernie no elige por vos.`
            : "Lo categorizaste una sola vez. Bernie prefiere que elijas vos."}
        </p>
      )}

      {muted && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sin agrupar: cada gasto va por su cuenta.
        </p>
      )}

      {open && !muted && (
        <GroupPicker
          categories={categories}
          count={group.count}
          busy={busy}
          onSave={(taxonomy) => save(taxonomy)}
        />
      )}

      {open && muted && (
        <ul className="mt-3 space-y-1.5">
          {group.expenses.map((expense) => (
            <li key={expense.id} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {formatShortDate(expense.occurred_at)}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(Number(expense.amount), expense.currency)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || disabled}
                  onClick={() => setSingleId(singleId === expense.id ? null : expense.id)}
                >
                  <Tag className="size-4" />
                  {singleId === expense.id ? "Cerrar" : "Elegir"}
                </Button>
              </div>
              {singleId === expense.id && (
                <GroupPicker
                  categories={categories}
                  count={1}
                  busy={busy}
                  onSave={(taxonomy) => save(taxonomy, [expense.id])}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={toggleRule}
        disabled={savingRule || busy || disabled}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <Unlink className="size-3.5" />
        {muted ? "Volver a agrupar este comercio" : "No agrupar este comercio"}
      </button>
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

  // Con categoría alcanza: sin subcategoría el gasto va a "General" (§7.2.2).
  const ready = category.kind !== "none" || subcategory.kind !== "none";

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
            placeholder={category.kind === "none" ? "Elige categoría" : "General"}
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

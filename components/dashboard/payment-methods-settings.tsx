"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "@/app/(dashboard)/settings/actions";

export type BankOption = { id: string; name: string };
export type PaymentMethod = {
  id: string;
  user_bank_id: string;
  type: string;
  identifier: string;
  alias: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function PaymentMethodsSettings({
  banks,
  methods,
}: {
  banks: BankOption[];
  methods: PaymentMethod[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const bankName = (id: string) => banks.find((b) => b.id === id)?.name ?? "—";

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(method: PaymentMethod) {
    setEditing(method);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      {methods.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {methods.map((method) => (
            <li
              key={method.id}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {method.alias ?? `${TIPO_LABEL[method.type] ?? method.type} ${method.identifier}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {TIPO_LABEL[method.type] ?? method.type} · {bankName(method.user_bank_id)}
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => openEdit(method)}>
                <Pencil className="size-4" />
              </Button>
              <DeleteButton id={method.id} />
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="outline"
        onClick={openAdd}
        disabled={banks.length === 0}
        className="w-full"
      >
        <Plus className="size-4" />
        Agregar medio de pago
      </Button>
      {banks.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Conecta un banco arriba para poder agregar medios de pago.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">
              {editing ? "Editar medio" : "Nuevo medio de pago"}
            </DialogTitle>
          </DialogHeader>
          {open && (
            <PaymentMethodForm
              key={editing?.id ?? "new"}
              banks={banks}
              method={editing}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentMethodForm({
  banks,
  method,
  onClose,
}: {
  banks: BankOption[];
  method: PaymentMethod | null;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const result = method
      ? await updatePaymentMethod(method.id, formData)
      : await createPaymentMethod(formData);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast.success(method ? "Medio actualizado" : "Medio agregado");
    onClose();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="userBankId">Banco</Label>
        <select
          id="userBankId"
          name="userBankId"
          defaultValue={method?.user_bank_id ?? banks[0]?.id}
          className={SELECT_CLASS}
        >
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Tipo</Label>
          <select
            id="type"
            name="type"
            defaultValue={method?.type ?? "credit_card"}
            className={SELECT_CLASS}
          >
            <option value="credit_card">Tarjeta de crédito</option>
            <option value="debit_card">Tarjeta de débito</option>
            <option value="yape">Yape</option>
            <option value="account">Cuenta</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Identificador</Label>
          <Input
            id="identifier"
            name="identifier"
            placeholder="****2813"
            defaultValue={method?.identifier}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alias">Alias (opcional)</Label>
        <Input
          id="alias"
          name="alias"
          placeholder="Ej. TC BCP"
          defaultValue={method?.alias ?? ""}
        />
      </div>

      {error && <p className="text-sm text-expense">{error}</p>}

      <DialogFooter className="gap-2 sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      className="text-expense hover:text-expense"
      onClick={() => {
        if (!confirm("¿Eliminar este medio de pago?")) return;
        startTransition(async () => {
          const res = await deletePaymentMethod(id);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Medio eliminado");
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

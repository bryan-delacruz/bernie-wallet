"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Check, Info, Loader2, X } from "lucide-react";
import { BernieLogo } from "@/components/brand/bernie-logo";
import { Button } from "@/components/ui/button";
import { approveConsent, denyConsent } from "./actions";

type Category = { id: string; name: string };

const SHARES = ["Fecha, monto y moneda de cada gasto", "Nombre del comercio", "Subcategoría"];
const NEVER = ["Tus tarjetas, cuentas y bancos", "Tus correos", "Gastos de otras categorías"];

export function ConsentForm({
  authorizationId,
  clientName,
  clientHost,
  email,
  categories,
  preselected,
}: {
  authorizationId: string;
  clientName: string;
  clientHost: string;
  email: string;
  categories: Category[];
  preselected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<"approve" | "deny" | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(kind: "approve" | "deny") {
    setError(null);
    setDecision(kind);
    startTransition(async () => {
      // Si sale bien, la action redirige a la app y esta pantalla se va.
      const res = kind === "approve"
        ? await approveConsent(authorizationId, [...selected])
        : await denyConsent(authorizationId);
      if (res?.error) {
        setError(res.error);
        setDecision(null);
      }
    });
  }

  const initial = clientName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="space-y-7">
      <header className="space-y-5 text-center">
        <div className="flex items-center justify-center gap-3" aria-hidden>
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BernieLogo decorative className="size-6" />
          </span>
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted font-heading text-xl font-medium">
            {initial}
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-medium tracking-tight text-balance">
            {clientName} quiere ver algunos de tus gastos
          </h1>
          <p className="text-sm text-muted-foreground">
            Volverás a <span className="font-medium text-foreground">{clientHost}</span> al terminar.
          </p>
        </div>
      </header>

      <div className="grid gap-4 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-2">
        <div className="space-y-2">
          <p className="font-medium">Compartirá</p>
          <ul className="space-y-1.5">
            {SHARES.map((s) => (
              <li key={s} className="flex gap-2 text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Nunca</p>
          <ul className="space-y-1.5">
            {NEVER.map((s) => (
              <li key={s} className="flex gap-2 text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">¿Qué categorías compartes?</legend>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tienes categorías. Crea una en Bernie y vuelve a conectar.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => {
              const checked = selected.has(c.id);
              return (
                <li key={c.id}>
                  <label
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                      disabled={pending}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <p className="flex gap-2 rounded-lg border border-border p-3 text-xs text-pretty text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Las personas con las que compartes {clientName} verán estos gastos. Puedes desconectarla
        cuando quieras en Configuración → Apps conectadas.
      </p>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 sm:flex-1"
          onClick={() => submit("deny")}
          disabled={pending}
        >
          {decision === "deny" ? <Loader2 className="size-4 animate-spin" /> : null}
          Cancelar
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-11 sm:flex-1"
          onClick={() => submit("approve")}
          disabled={pending || selected.size === 0}
        >
          {decision === "approve" ? <Loader2 className="size-4 animate-spin" /> : null}
          Permitir
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Conectado como <span className="font-medium text-foreground">{email}</span>
      </p>
    </div>
  );
}

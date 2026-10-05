"use client";

import { useState, useTransition } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import type { ActiveChallenge } from "@/lib/challenges-data";
import { abandonChallenge, startChallenge } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const DURATIONS = [7, 14, 30];

/** Objetivo posible de un reto: una categoría entera o una de sus subcategorías. */
export type ChallengeTarget = { value: string; label: string; nested?: boolean };

export function ChallengeCard({
  challenge,
  targets,
}: {
  challenge: ActiveChallenge | null;
  targets: ChallengeTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!challenge) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={targets.length === 0}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:border-[var(--chart-1)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Target className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="block text-sm font-medium">Empezar un reto</span>
            <span className="block text-[11px] text-muted-foreground">
              {targets.length === 0
                ? "Primero categoriza algún gasto."
                : "Aguanta unos días sin gastar en una categoría."}
            </span>
          </span>
        </button>
        <StartDialog open={open} onOpenChange={setOpen} targets={targets} />
      </>
    );
  }

  const pct = Math.min(100, Math.round((challenge.current / challenge.targetDays) * 100));

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Reto en curso
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-3xl font-medium tracking-tight tabular-nums">
              {challenge.current}
            </span>
            <span className="text-sm text-muted-foreground">
              de {challenge.targetDays} días sin {challenge.targetLabel}
            </span>
          </p>
        </div>
        <form
          action={(formData) =>
            start(async () => {
              const result = await abandonChallenge(formData);
              if (result.error) toast.error(result.error);
            })
          }
          className="ml-auto"
        >
          <input type="hidden" name="id" value={challenge.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            Terminar
          </Button>
        </form>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/15">
        <div
          className={cn("h-full rounded-full", challenge.done ? "bg-[#c9904e]" : "bg-[var(--chart-1)]")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {challenge.done
          ? "Reto cumplido. Puedes seguir sumando días."
          : challenge.restarts > 0
            ? `Volviste a empezar ${challenge.restarts === 1 ? "una vez" : `${challenge.restarts} veces`}. Tu mejor intento: ${challenge.best} días.`
            : "Un gasto de esa categoría reinicia el contador, no termina el reto."}
      </p>
    </section>
  );
}

function StartDialog({
  open,
  onOpenChange,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: ChallengeTarget[];
}) {
  const [days, setDays] = useState(30);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-medium">Nuevo reto</DialogTitle>
          <DialogDescription>
            Elige en qué no vas a gastar y por cuántos días. Si gastas, el contador
            vuelve a empezar y el reto sigue.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) =>
            start(async () => {
              const result = await startChallenge(formData);
              if (result.error) toast.error(result.error);
              else onOpenChange(false);
            })
          }
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="target">Sin gastar en</Label>
            <select id="target" name="target" className={SELECT_CLASS}>
              {targets.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.nested ? `  ${t.label}` : t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Durante</Label>
            <input type="hidden" name="targetDays" value={days} />
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={cn(
                    "rounded px-3 py-1.5 transition-colors",
                    days === d
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d} días
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Empezando…" : "Empezar reto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

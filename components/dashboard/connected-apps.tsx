"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { History, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  disconnectApp,
  revokeOrphanGrant,
  updateAppShares,
} from "@/app/(dashboard)/settings/actions";

type Category = { id: string; name: string };
type AuditEntry = { id: string; action: string; at: string; categories: string[] };
export type ConnectedApp = {
  clientId: string;
  name: string;
  connectedAt: string;
  sharedIds: string[];
  history: AuditEntry[];
};
export type OrphanGrant = { clientId: string; name: string };

const ACTION_LABEL: Record<string, string> = {
  granted: "Conectada",
  shares_changed: "Categorías cambiadas",
  revoked: "Desconectada",
};

const dateFmt = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ConnectedApps({
  apps,
  categories,
  orphanGrants,
}: {
  apps: ConnectedApp[];
  categories: Category[];
  orphanGrants: OrphanGrant[];
}) {
  if (apps.length === 0 && orphanGrants.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <Plug className="size-5 shrink-0" aria-hidden />
        Ninguna app conectada. Cuando conectes una (por ejemplo, Casorio Club), aparecerá aquí.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {apps.map((app) => (
        <AppCard key={app.clientId} app={app} categories={categories} />
      ))}
      {orphanGrants.map((grant) => (
        <OrphanGrantRow key={grant.clientId} grant={grant} />
      ))}
    </ul>
  );
}

function AppAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-heading text-lg font-medium"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function AppCard({ app, categories }: { app: ConnectedApp; categories: Category[] }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(app.sharedIds));
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const sharedNames = app.sharedIds.map((id) => nameById.get(id)).filter(Boolean) as string[];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await updateAppShares(app.clientId, [...selected]);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${app.name} verá solo las categorías elegidas`);
      setEditing(false);
    });
  }

  function disconnect() {
    startTransition(async () => {
      const res = await disconnectApp(app.clientId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setConfirming(false);
      if (res.partial) {
        toast.warning(`${app.name} ya no ve tus gastos. Quedó un permiso por quitar: revísalo abajo.`);
      } else {
        toast.success(`${app.name} desconectada`);
      }
    });
  }

  return (
    <li className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <AppAvatar name={app.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{app.name}</p>
          <p className="text-sm text-muted-foreground">
            Conectada el {dateFmt.format(new Date(app.connectedAt))}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={pending}>
          Desconectar
        </Button>
      </div>

      {editing ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Categorías que comparte</legend>
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
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(new Set(app.sharedIds));
                setEditing(false);
              }}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={pending || selected.size === 0}>
              Guardar
            </Button>
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Comparte:</span>
          {sharedNames.length ? (
            sharedNames.map((name) => (
              <span key={name} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {name}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">nada</span>
          )}
          <Button variant="link" size="sm" className="h-auto px-1" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      )}

      {app.history.length ? (
        <details className="group text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <History className="size-4" aria-hidden />
            Historial
          </summary>
          <ol className="mt-2 space-y-1.5 border-l border-border pl-3">
            {app.history.map((h) => (
              <li key={h.id} className="text-muted-foreground">
                <span className="text-foreground">{ACTION_LABEL[h.action] ?? h.action}</span>
                {" · "}
                {dateFmt.format(new Date(h.at))}
                {h.categories.length ? ` · ${h.categories.join(", ")}` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">
              ¿Desconectar {app.name}?
            </DialogTitle>
            <DialogDescription>
              Dejará de recibir tus gastos al instante. Lo que ya recibió se queda en {app.name}.
              Puedes volver a conectarla desde la propia app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={disconnect} disabled={pending}>
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** Permiso que sigue vivo en Supabase Auth sin conexión en Bernie: no lee datos, pero se ofrece limpiarlo. */
function OrphanGrantRow({ grant }: { grant: OrphanGrant }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
      <AppAvatar name={grant.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{grant.name}</p>
        <p className="text-sm text-muted-foreground">Sin acceso a tus gastos · queda un permiso de inicio de sesión</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await revokeOrphanGrant(grant.clientId);
            if (res.error) toast.error(res.error);
            else toast.success("Permiso quitado");
          })
        }
      >
        Quitar permiso
      </Button>
    </li>
  );
}

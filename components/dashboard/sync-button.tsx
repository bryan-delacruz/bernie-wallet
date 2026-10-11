"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SyncResult = {
  nuevos: number;
  restantes?: number;
  descartados?: number;
  detenido?: boolean;
};

/** Mensaje tras sincronizar: gastos nuevos + cuántos correos quedan pendientes. */
function buildSummary({ nuevos, restantes = 0, descartados = 0, detenido }: SyncResult): string {
  const base = nuevos > 0 ? `${nuevos} gasto(s) nuevo(s)` : "Sin gastos nuevos";
  const descarteNote = descartados > 0 ? ` · ${descartados} correo(s) omitido(s)` : "";
  if (detenido) {
    return `${base}${descarteNote} · se pausó por un error temporal, vuelve a sincronizar`;
  }
  if (restantes > 0) {
    return `${base}${descarteNote} · quedan ${restantes} correo(s), sincroniza de nuevo`;
  }
  if (descartados > 0) {
    return `${base}${descarteNote}. Estás al día.`;
  }
  return nuevos > 0 ? `${base}. Estás al día.` : "Estás al día.";
}

/** Botón de sincronización. El progreso y el resultado se comunican por toast;
 *  el estado persistente (última sync / cobertura) lo renderiza la página. Si el
 *  acceso a Gmail se perdió (token/permiso), abre un modal para reconectar. */
export function SyncButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  // Mensaje del error de acceso a Gmail; su presencia abre el modal de reconexión.
  const [authError, setAuthError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function sync() {
    setLoading(true);
    const id = toast.loading("Sincronizando… leyendo tus correos");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "gmail_auth") {
          toast.dismiss(id);
          setAuthError(data.error ?? "Se perdió el acceso a Gmail.");
        } else {
          toast.error(data.error ?? "No se pudo sincronizar.", { id });
        }
      } else if (data.message) {
        toast.info(data.message, { id });
      } else {
        toast.success(buildSummary(data), { id });
        router.refresh();
      }
    } catch {
      toast.error("Error de red al sincronizar.", { id });
    } finally {
      setLoading(false);
    }
  }

  function connectGmail() {
    setConnecting(true);
    // Flujo propio de Gmail (SPEC §19.3): sin cerrar sesión, y de vuelta acá.
    window.location.assign(`/api/gmail/connect?next=${encodeURIComponent(pathname)}`);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={sync}
        disabled={loading}
        className={cn("h-11 text-sm", className)}
      >
        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        {loading ? "Sincronizando…" : "Sincronizar"}
      </Button>

      <Dialog open={authError !== null} onOpenChange={(open) => !open && setAuthError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conecta tu Gmail</DialogTitle>
            <DialogDescription>
              Bernie no tiene acceso a tus correos, por eso no pudo sincronizar. Al
              conectarlo, Google te pedirá el permiso de lectura de correos: déjalo
              marcado. También puedes seguir sin conectarlo y anotar tus gastos a mano.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Ahora no</DialogClose>
            <Button onClick={connectGmail} disabled={connecting}>
              <Mail className="size-4" />
              {connecting ? "Abriendo…" : "Conectar Gmail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 *  el estado persistente (última sync / cobertura) lo renderiza la página. */
export function SyncButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sync() {
    setLoading(true);
    const id = toast.loading("Sincronizando… leyendo tus correos");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo sincronizar.", { id });
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

  return (
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
  );
}

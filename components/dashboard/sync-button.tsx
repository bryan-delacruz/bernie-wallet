"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  "Leyendo tus correos…",
  "Analizando con Bernie…",
  "Registrando tus gastos…",
];

const SCOPE_HINT = "Revisa los últimos 30 días · hasta 100 correos";

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

function relativeFromNow(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} día${days > 1 ? "s" : ""}`;
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(
    new Date(iso),
  );
}

export function SyncButton({ lastSyncAt }: { lastSyncAt: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const idleHint = lastSyncAt
    ? `Última sincronización: ${relativeFromNow(lastSyncAt)}`
    : SCOPE_HINT;

  // Rota los mensajes de etapa mientras sincroniza (loading informativo).
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setStep((i) => (i + 1) % STEPS.length), 2500);
    return () => clearInterval(timer);
  }, [loading]);

  async function sync() {
    setStep(0);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "No se pudo sincronizar.");
      } else if (data.message) {
        setMessage(data.message);
      } else {
        setMessage(buildSummary(data));
        router.refresh();
      }
    } catch {
      setMessage("Error de red al sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={sync}
        disabled={loading}
        className="h-11 w-full text-sm"
      >
        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        {loading ? "Sincronizando…" : "Sincronizar"}
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground/80">
        {loading ? STEPS[step] : (message ?? idleHint)}
      </p>
    </div>
  );
}

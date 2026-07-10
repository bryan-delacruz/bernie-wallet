"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Evento no estándar de Chromium para instalar la PWA. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noop = () => () => {};

// ¿La app corre ya instalada (standalone)? Reacciona a instalar/desinstalar.
function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  window.addEventListener("appinstalled", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("appinstalled", cb);
  };
}
const getStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const getIsIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !("MSStream" in window);

/** Instalar Bernie como app: botón nativo (Android/Chrome) o instrucciones (iOS).
 *  Se oculta si ya está instalada (modo standalone). */
export function InstallApp() {
  const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, () => false);
  const isIOS = useSyncExternalStore(noop, getIsIOS, () => false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (standalone) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Check className="size-4 text-primary" />
        Bernie ya está instalada en este dispositivo.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm">
        Instala Bernie como app para abrirla desde tu pantalla de inicio, a
        pantalla completa y sin la barra del navegador.
      </p>

      {deferred ? (
        <Button type="button" onClick={install} className="mt-3 h-10 text-sm">
          <Download className="size-4" />
          Instalar app
        </Button>
      ) : isIOS ? (
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              1
            </span>
            Toca <Share className="size-4" /> Compartir en Safari.
          </p>
          <p className="flex items-center gap-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              2
            </span>
            Elige <SquarePlus className="size-4" /> “Añadir a inicio”.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Abre el menú de tu navegador y elige “Instalar app” o “Agregar a
          pantalla de inicio”.
        </p>
      )}
    </div>
  );
}

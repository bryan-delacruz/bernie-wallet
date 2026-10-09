"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  enableDailyNotification,
  disableDailyNotification,
} from "@/app/(dashboard)/settings/actions";

/** Qué puede hacer este navegador. Se resuelve en el cliente: en el servidor no
 *  hay forma de saberlo, y adivinar lleva a ofrecer algo que no funciona. */
type Soporte =
  | "cargando"
  | "listo"
  /** iPhone en Safari, sin instalar: Apple no da push fuera de la app instalada. */
  | "requiere-instalar"
  | "no-soportado"
  /** El usuario ya dijo que no. Solo se revierte desde el navegador. */
  | "bloqueado";

/** La clave pública VAPID viaja en base64url; `pushManager` la quiere en bytes. */
function claveABytes(base64url: string): Uint8Array {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binario = atob(base64);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function aBase64url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function detectarSoporte(): Soporte {
  const instalada =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS no implementa `display-mode: standalone` en todas las versiones.
    ("standalone" in window.navigator && Boolean(window.navigator.standalone));
  const esIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return esIOS && !instalada ? "requiere-instalar" : "no-soportado";
  }
  if (Notification.permission === "denied") return "bloqueado";
  return "listo";
}

export function DailyNotification({ enabled }: { enabled: boolean }) {
  const [soporte, setSoporte] = useState<Soporte>("cargando");
  const [activa, setActiva] = useState(enabled);
  const [pendiente, start] = useTransition();

  // Lo que este navegador puede hacer solo se sabe en el cliente. La detección va
  // en una tarea aparte, no en el cuerpo del efecto: `setState` sincrónico ahí
  // encadena renders, y acá no hay apuro — el control aparece un frame después.
  useEffect(() => {
    const id = setTimeout(() => setSoporte(detectarSoporte()), 0);
    return () => clearTimeout(id);
  }, []);

  async function prender() {
    const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!clave) {
      toast.error("Las notificaciones no están configuradas todavía.");
      return;
    }

    // El permiso se pide acá y no al entrar: pedirlo de entrada es la forma más
    // rápida de que lo nieguen para siempre.
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      setSoporte(permiso === "denied" ? "bloqueado" : "listo");
      return;
    }

    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const suscripcion = await registro.pushManager.subscribe({
      // El navegador lo exige: todo push tiene que mostrar algo.
      userVisibleOnly: true,
      applicationServerKey: claveABytes(clave) as BufferSource,
    });

    start(async () => {
      const resultado = await enableDailyNotification({
        endpoint: suscripcion.endpoint,
        p256dh: aBase64url(suscripcion.getKey("p256dh")),
        auth: aBase64url(suscripcion.getKey("auth")),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      setActiva(true);
      toast.success("Listo. Bernie te saluda a las 10 de la mañana.");
    });
  }

  async function apagar() {
    let endpoint: string | undefined;
    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const suscripcion = await registro?.pushManager.getSubscription();
      endpoint = suscripcion?.endpoint;
      await suscripcion?.unsubscribe();
    } catch {
      // Si el navegador no la suelta, igual se apaga del lado del servidor.
    }

    start(async () => {
      const resultado = await disableDailyNotification(endpoint);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      setActiva(false);
      toast.success("Apagado. Bernie no te escribe más.");
    });
  }

  if (soporte === "cargando") return null;

  if (soporte === "requiere-instalar") {
    return (
      <p className="text-sm text-muted-foreground">
        En iPhone, Bernie solo puede escribirte si instalas la app desde Safari a tu
        pantalla de inicio. Lo tienes en la sección de abajo.
      </p>
    );
  }

  if (soporte === "no-soportado") {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador no puede recibir notificaciones.
      </p>
    );
  }

  if (soporte === "bloqueado") {
    return (
      <p className="text-sm text-muted-foreground">
        Bloqueaste las notificaciones para esta app. Se vuelve a permitir desde los
        ajustes del navegador, no desde acá.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant={activa ? "outline" : "default"}
        disabled={pendiente}
        onClick={() => (activa ? apagar() : prender())}
      >
        <Bell className="size-4" />
        {activa ? "Desactivar" : "Activar"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Una vez al día, a las 10 de la mañana. Bernie no menciona montos ni comercios:
        la notificación se lee en la pantalla bloqueada.
      </p>
    </div>
  );
}

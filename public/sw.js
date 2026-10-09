// Service worker de Bernie Wallet — SOLO para notificaciones push (SPEC §19.2).
//
// No cachea nada y no intercepta `fetch`. Un service worker que cachea mal es peor
// que no tenerlo: deja a la gente mirando una versión vieja sin entender por qué.

/** Lo que se muestra si no se puede pedir la frase del día. El navegador exige
 *  que todo push muestre algo (`userVisibleOnly`), así que callarse no es opción. */
const RESPALDO = "Acá andamos, cuidando tus cuentas.";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(mostrar());
});

async function mostrar() {
  let texto = RESPALDO;

  // El aviso llega vacío: la frase se pide ahora, con la racha y los pendientes de
  // este momento, no con los de cuando el cron despachó.
  try {
    const respuesta = await fetch("/api/notifications/today", { credentials: "include" });
    if (respuesta.ok) {
      const datos = await respuesta.json();
      if (datos && typeof datos.text === "string" && datos.text) texto = datos.text;
    }
  } catch {
    // Sin red: queda el respaldo.
  }

  await self.registration.showNotification("Bernie", {
    body: texto,
    icon: "/icon-192",
    badge: "/icon-192",
    tag: "bernie-daily", // una sola notificación viva: no se apilan días
    renotify: false,
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(abrirApp());
});

async function abrirApp() {
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  // Si ya hay una pestaña de la app abierta, se enfoca en vez de abrir otra.
  for (const ventana of ventanas) {
    if ("focus" in ventana) return ventana.focus();
  }
  return self.clients.openWindow("/dashboard");
}

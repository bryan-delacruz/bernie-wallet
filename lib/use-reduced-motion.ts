"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * `true` cuando el sistema pide menos movimiento. En el servidor devuelve `false`
 * (la preferencia solo existe en el cliente) y React reconcilia al hidratar.
 *
 * Las animaciones CSS se cubren con la variante `motion-reduce` de Tailwind; esto
 * es para el movimiento que controla JS, como las series de Recharts.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

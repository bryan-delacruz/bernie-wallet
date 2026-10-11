"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, { kind: "success" | "error" | "info"; text: string }> = {
  connected: { kind: "success", text: "Gmail conectado. Bernie ya puede anotar tus gastos." },
  denied: {
    kind: "info",
    text: "No se conectó Gmail: hace falta el permiso de lectura de correos.",
  },
  mismatch: {
    kind: "error",
    text: "Ese Gmail no es el de tu cuenta. Conecta el mismo correo con el que entras.",
  },
  error: { kind: "error", text: "No pudimos conectar Gmail. Inténtalo de nuevo." },
};

/** Avisa el resultado de "Conectar Gmail" (`?gmail=`, SPEC §19.3) y limpia la URL
 *  para que el aviso no reaparezca al recargar. */
export function GmailOutcomeToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const outcome = params.get("gmail");

  useEffect(() => {
    const message = outcome ? MESSAGES[outcome] : undefined;
    if (!message) return;
    toast[message.kind](message.text);
    const rest = new URLSearchParams(params);
    rest.delete("gmail");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [outcome, params, pathname, router]);

  return null;
}

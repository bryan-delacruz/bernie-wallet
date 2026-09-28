"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * "Probar la demo". La cuenta anónima se crea desde el navegador a propósito:
 * así el límite de Supabase (cuentas anónimas por hora) se aplica por visitante
 * y no a la IP del servidor, que compartirían todos.
 */
export default function DemoPage() {
  const router = useRouter();
  const [error, setError] = useState(false);
  // En desarrollo React monta dos veces: sin esto se crearían dos cuentas.
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user && !data.user.is_anonymous) {
        router.replace("/dashboard");
        return;
      }
      if (!data.user) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) {
          setError(true);
          return;
        }
      }
      const res = await fetch("/api/demo", { method: "POST" });
      if (!res.ok) {
        setError(true);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-lg">La demo no está disponible en este momento.</p>
          <Link href="/" className="text-sm text-[#0e7c58] underline underline-offset-4">
            Volver al inicio
          </Link>
        </>
      ) : (
        <p className="text-muted-foreground" aria-live="polite">
          Preparando la demo con gastos de ejemplo…
        </p>
      )}
    </main>
  );
}

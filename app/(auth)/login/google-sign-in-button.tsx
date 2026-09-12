"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GMAIL_SCOPES =
  "email profile https://www.googleapis.com/auth/gmail.readonly";

const ERROR_MESSAGE = "No pudimos conectar con Google. Inténtalo de nuevo.";

/** Marca oficial "G" de Google, sobre chip blanco para que resalte en el botón. */
function GoogleGlyph() {
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.66 14.97.72 12 .72 7.7.72 3.99 3.19 2.18 6.79l3.66 2.84C6.71 6.98 9.14 5.04 12 5.04z"
        />
        <path
          fill="#4285F4"
          d="M23.28 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.12 2.73-2.38 3.58l3.65 2.83c2.13-1.97 3.54-4.87 3.54-8.65z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.18 7.07C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        />
        <path
          fill="#34A853"
          d="M12 23.28c2.97 0 5.46-.98 7.28-2.66l-3.65-2.83c-.98.66-2.23 1.06-3.63 1.06-2.86 0-5.29-1.94-6.16-4.55L2.18 16.93C3.99 20.53 7.7 23.28 12 23.28z"
        />
      </svg>
    </span>
  );
}

export function GoogleSignInButton({
  className,
  reconnect = false,
}: {
  className?: string;
  /** Reconexión: fuerza el consentimiento para que Google emita un refresh_token
   *  nuevo. En un login normal se omite, porque `prompt=consent` obliga a Google a
   *  mostrar el consentimiento y el aviso de "app no verificada" cada vez. */
  reconnect?: boolean;
}) {
  // Cliente Supabase instanciado una sola vez (lazy init), no en cada clic:
  // evita crear múltiples GoTrueClient.
  const [supabase] = useState(createClient);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: GMAIL_SCOPES,
          // access_type=offline pide el refresh_token; Google solo lo entrega en la
          // primera autorización o si se fuerza el consentimiento (reconexión).
          queryParams: {
            access_type: "offline",
            ...(reconnect ? { prompt: "consent" } : {}),
          },
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      // Sin error, el navegador redirige a Google: mantenemos el estado de carga.
      if (error) {
        setError(ERROR_MESSAGE);
        setLoading(false);
      }
    } catch {
      setError(ERROR_MESSAGE);
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Button
        type="button"
        onClick={signIn}
        disabled={loading}
        size="lg"
        className="h-11 w-full gap-2.5 px-6 text-base"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        {loading ? "Conectando…" : reconnect ? "Reconectar Gmail" : "Continuar con Google"}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BernieLogo } from "@/components/brand/bernie-logo";
import { LoginShowcase } from "@/components/auth/login-showcase";
import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata: Metadata = {
  title: "Entrar",
  // Una pantalla de login no debe indexarse.
  robots: { index: false, follow: false },
};

// Barra de confianza compacta (solo móvil): trae al login lo que en desktop
// vive en el panel esmeralda, sin robarle foco al botón.
const TRUST = [
  { icon: ShieldCheck, label: "Solo lectura" },
  { icon: Lock, label: "Cifrado" },
  { icon: RotateCcw, label: "Reversible" },
];

// Mensajes por código de error que puede llegar del callback OAuth.
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Cancelaste el acceso en Google. Puedes intentarlo de nuevo cuando quieras.",
  auth: "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
  missing_code: "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
};
const DEFAULT_ERROR = "Ocurrió un problema al iniciar sesión. Inténtalo de nuevo.";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reconnect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { error, reconnect } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? DEFAULT_ERROR) : null;
  // Reconexión: el login normal no fuerza el consentimiento, así que este es el
  // único camino que reemite el refresh_token cuando se pierde el acceso a Gmail.
  const isReconnect = reconnect === "1";

  return (
    <main className="flex flex-1 lg:grid lg:grid-cols-[55fr_45fr]">
      <LoginShowcase />

      {/* Columna de acceso. Móvil: fondo esmeralda + tarjeta flotante.
          Desktop: columna marfil sobria (el esmeralda ya vive en el panel). */}
      <div className="relative isolate flex flex-1 flex-col items-center gap-6 px-6 py-10 lg:flex-none lg:items-stretch lg:gap-0 lg:px-6 lg:py-8">
        {/* Fondo esmeralda — solo móvil */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 lg:hidden"
          style={{
            background:
              "linear-gradient(160deg, #0d7351 0%, #0a5540 52%, #073c2d 100%)",
          }}
        />

        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 self-center lg:self-start"
        >
          <BernieLogo className="size-7 text-white lg:text-primary" />
          <span className="font-heading text-lg font-medium tracking-tight text-white lg:text-foreground">
            Bernie Wallet
          </span>
        </Link>

        <div className="flex w-full flex-col items-center lg:flex-1 lg:justify-center">
          {/* La tarjeta: chrome en móvil, se disuelve en desktop */}
          <div className="w-full max-w-sm space-y-8 rounded-2xl bg-card p-8 text-center shadow-[0_24px_60px_-15px_rgba(0,0,0,0.45)] lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="space-y-3">
              <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
                {isReconnect ? "Reconecta tu Gmail" : "Entra a Bernie Wallet"}
              </h1>
              <p className="text-base text-muted-foreground">
                {isReconnect
                  ? "Vuelve a dar el permiso de lectura de correos para seguir sincronizando."
                  : "Conecta tu Gmail para registrar tus gastos."}
              </p>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <GoogleSignInButton className="w-full" reconnect={isReconnect} />

            {/* Desktop: nota breve (las garantías ya viven en el panel) */}
            <p className="hidden items-center justify-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <Lock className="size-3.5" />
              Solo lectura de tu Gmail · cifrado.
            </p>

            {/* Móvil: mini-barra de garantías */}
            <ul className="grid grid-cols-3 gap-2 border-t border-border pt-6 lg:hidden">
              {TRUST.map((t) => (
                <li key={t.label} className="flex flex-col items-center gap-1.5">
                  <t.icon className="size-4 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Link
          href="/"
          className="mx-auto inline-flex items-center gap-1.5 text-sm text-white/80 transition-colors hover:text-white lg:text-muted-foreground lg:hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a inicio
        </Link>
      </div>
    </main>
  );
}

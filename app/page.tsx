import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { BernieLogoColor } from "@/components/brand/bernie-logo";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* Glow esmeralda sutil en la parte superior; se adapta a light/dark vía --primary */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--primary) 13%, transparent), transparent)",
        }}
      />

      <div className="relative flex max-w-xl flex-col items-center gap-7">
        <div className="flex items-center gap-2.5">
          <BernieLogoColor className="size-8" />
          <span className="font-heading text-lg font-medium tracking-tight">
            Bernie Wallet
          </span>
        </div>

        <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
          Tus gastos se anotan solos.
        </h1>

        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          Bernie lee los correos de tu banco y registra cada gasto por ti. Tú
          solo revisas.
        </p>

        {user ? (
          <Link
            href="/dashboard"
            className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}
          >
            Ir al dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}
          >
            Iniciar sesión con Google
          </Link>
        )}

        <p className="text-xs text-muted-foreground/80">
          Conecta tu Gmail · solo lectura · tus datos son tuyos.
        </p>
      </div>
    </main>
  );
}

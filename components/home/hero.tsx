import { Lock } from "lucide-react";
import { BalanceGem } from "@/components/home/balance-gem";
import { CtaButton } from "@/components/home/cta-button";

/** Hero: la gema sobre marfil, con halo suave. */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-24 text-center sm:pt-24">
      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#e8e4da] bg-white px-3 py-1 text-xs font-medium text-[#6b675b]">
          <span className="size-1.5 rounded-full bg-[#0e7c58]" />
          Registro de gastos automático · BCP
        </span>

        <h1 className="font-heading text-5xl leading-[1.03] font-medium tracking-tight text-balance sm:text-6xl">
          Tus gastos se anotan solos.
        </h1>

        <p className="max-w-md text-lg leading-relaxed text-pretty text-[#6b675b]">
          Bernie lee los correos de tu banco y lleva la cuenta por ti. Tú solo revisas.
        </p>

        <div className="flex flex-col items-center gap-3 pt-1">
          <CtaButton />
          <p className="flex items-center gap-1.5 text-xs text-[#6b675b]/80">
            <Lock className="size-3.5" />
            Solo lectura de tu Gmail · cifrado.
          </p>
        </div>
      </div>

      {/* La tarjeta-joya sobre un halo esmeralda tenue, con reveal en CSS */}
      <div className="relative mx-auto mt-16 w-full max-w-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-16 -bottom-12 top-6 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(14,124,88,0.16), transparent 70%)" }}
        />
        <div className="relative animate-in fade-in duration-700 motion-reduce:animate-none">
          <BalanceGem />
        </div>
      </div>
    </section>
  );
}

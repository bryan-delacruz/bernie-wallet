import Link from "next/link";
import { ArrowRight, Eye, Link2, Lock, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BernieLogoColor } from "@/components/brand/bernie-logo";
import { cn } from "@/lib/utils";

// Landing "La Vitrina" · atmósfera ÚNICA marfil (Lacoste/Apple). Estática, Server
// Component, cero JS de cliente. Paleta FIJA (clases arbitrarias, no tokens del
// tema) para que el marfil premium no cambie con el modo del usuario. El único
// movimiento es el reveal en CSS de la tarjeta.

const ctaClass = (extra = "") =>
  cn(
    buttonVariants({ size: "lg" }),
    "group h-12 gap-2 rounded-xl bg-[#0e7c58] px-6 text-base font-medium text-white",
    "shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-[background-color,transform] duration-150 ease-out",
    // hover: esmeralda más claro (sin sombra) — limpio
    "hover:bg-[#13946a]",
    "active:scale-[0.97]",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
    extra,
  );

export default function HomePage() {
  return (
    <div className="bg-[#f6f4ef] text-[#17160f]">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Trust />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Header (marfil, sutilmente pegajoso) ─────────────────────────────── */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e8e4da] bg-[#f6f4ef]/80 backdrop-blur-lg shadow-[0_2px_16px_-12px_rgba(23,22,15,0.35)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BernieLogoColor className="size-7" decorative />
          <span className="font-heading text-lg font-medium tracking-tight">Bernie Wallet</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm text-[#17160f] transition-colors hover:bg-[#0e7c58]/10 hover:text-[#0e7c58]",
            )}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 rounded-lg bg-[#0e7c58] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#13946a]",
            )}
          >
            Empezar
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ── Hero: la gema sobre marfil, con halo suave ───────────────────────── */

function Hero() {
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
          <Link href="/login" className={ctaClass()}>
            Empezar con Google
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
          </Link>
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

/** Tarjeta metálica de saldo — el objeto de lujo del hero. */
function BalanceGem() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-[0_2px_4px_rgba(0,0,0,0.06),0_32px_64px_-20px_rgba(23,22,15,0.28),0_0_64px_-24px_rgba(14,124,88,0.4)]"
      style={{ background: "linear-gradient(150deg, #12946a 0%, #0e7c58 46%, #0a5540 100%)" }}
    >
      {/* Glow bronce del Boyero, en la esquina */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full opacity-40 blur-2xl"
        style={{ background: "radial-gradient(circle, #c9904e, transparent 70%)" }}
      />
      <p className="font-mono text-[11px] tracking-[0.16em] text-white/70 uppercase">
        Gastos de julio
      </p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums">
        S/ 2,480.60
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-semibold">
          R
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Rappi</p>
          <p className="text-[11px] text-white/70">Delivery · TC ••2813</p>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums">− S/ 32.90</span>
      </div>
    </div>
  );
}

/* ── Cómo funciona: aquí vive la magia correo→gasto ───────────────────── */

const STEPS = [
  {
    icon: Link2,
    title: "Conéctate",
    body: "Inicia sesión con Google. Bernie solo lee los correos de tu banco, nada más.",
  },
  {
    icon: Sparkles,
    title: "Bernie los lee",
    body: "Reconoce el monto, el comercio, la tarjeta y la categoría de cada notificación.",
  },
  {
    icon: Eye,
    title: "Tú revisas",
    body: "Ajusta lo que quieras. Tu balance del mes queda al día, solo.",
  },
];

function HowItWorks() {
  return (
    <section className="border-t border-[#e8e4da] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-mono text-xs font-medium tracking-[0.16em] text-[#0e7c58] uppercase">
            Cómo funciona
          </p>
          <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            De tu bandeja a tu balance, sin que muevas un dedo.
          </h2>
        </div>

        {/* Micro-demo correo → gasto (apoyo, no protagonista) */}
        <div className="mx-auto mt-12 flex max-w-lg flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <div className="w-full flex-1 rounded-xl border border-[#e8e4da] bg-[#f6f4ef] p-3.5">
            <p className="font-mono text-[11px] text-[#6b675b]">notificaciones@bcp.com.pe</p>
            <p className="mt-1 font-mono text-[12px] leading-snug text-[#17160f]/90">
              Realizaste un consumo… S/ 32.90 en RAPPI PERU
            </p>
          </div>
          <ArrowRight className="size-5 shrink-0 rotate-90 text-[#a96e32] sm:rotate-0" />
          <div className="flex w-full flex-1 items-center gap-3 rounded-xl border border-[#e8e4da] bg-[#f6f4ef] p-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Rappi</p>
              <p className="text-[11px] text-[#6b675b]">Delivery · TC ••2813</p>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-[#b23a36]">
              − S/ 32.90
            </span>
          </div>
        </div>

        <ol className="mx-auto mt-16 grid max-w-4xl gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col items-center gap-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#0e7c58]/10 text-[#0e7c58]">
                <step.icon className="size-5" />
              </span>
              <div className="space-y-1.5">
                <p className="font-mono text-xs font-medium text-[#6b675b]/70 tabular-nums">
                  0{i + 1}
                </p>
                <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
                <p className="mx-auto max-w-[15rem] text-sm leading-relaxed text-pretty text-[#6b675b]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Confianza: contención total ──────────────────────────────────────── */

const GUARANTEES = [
  { icon: ShieldCheck, title: "Solo lectura", body: "Bernie nunca envía ni borra correos." },
  { icon: Lock, title: "Cifrado", body: "Tu conexión con Gmail se guarda cifrada (AES-256)." },
  { icon: RotateCcw, title: "Reversible", body: "Desconéctalo cuando quieras, en un clic." },
];

function Trust() {
  return (
    <section className="border-t border-[#e8e4da]">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="font-mono text-xs font-medium tracking-[0.16em] text-[#0e7c58] uppercase">
          Privacidad
        </p>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Tu Gmail, en tus términos.
        </h2>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="flex flex-col items-center gap-3">
              <g.icon className="size-6 text-[#0e7c58]" />
              <div className="space-y-1">
                <h3 className="font-medium tracking-tight">{g.title}</h3>
                <p className="mx-auto max-w-[14rem] text-sm leading-relaxed text-pretty text-[#6b675b]">
                  {g.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA final (banda marfil sutil) ───────────────────────────────────── */

function FinalCta() {
  return (
    <section className="border-t border-[#e8e4da] bg-white">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-28 text-center">
        <h2 className="font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Deja de anotar gastos a mano.
        </h2>
        <p className="max-w-md text-lg text-pretty text-[#6b675b]">
          Conecta tu Gmail y deja que Bernie lleve la cuenta.
        </p>
        <Link href="/login" className={ctaClass("mt-2")}>
          Empezar con Google
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
        </Link>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────── */

function SiteFooter() {
  return (
    <footer className="border-t border-[#e8e4da] bg-[#ece7dc]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <div className="flex items-center gap-2">
            <BernieLogoColor className="size-5" decorative />
            <span className="font-heading text-base font-medium tracking-tight">Bernie Wallet</span>
          </div>
          <p className="text-xs text-[#6b675b]">Tus gastos se anotan solos.</p>
        </div>
        <p className="text-center text-xs text-[#6b675b]/70 sm:text-right">
          Hecho en Perú · © 2026 Bernie Wallet
        </p>
      </div>
    </footer>
  );
}

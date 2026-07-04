import { ArrowRight, Eye, Link2, Sparkles } from "lucide-react";

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

/** Cómo funciona: sección blanca; aquí vive la magia correo→gasto. */
export function HowItWorks() {
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

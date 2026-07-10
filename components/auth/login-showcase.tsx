import { Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { BalanceGem } from "@/components/home/balance-gem";

const GUARANTEES = [
  { icon: ShieldCheck, text: "Solo lectura — Bernie nunca envía ni borra correos." },
  { icon: Lock, text: "Cifrado — tu conexión con Gmail se guarda cifrada (AES-256)." },
  { icon: RotateCcw, text: "Reversible — desconéctalo cuando quieras, en un clic." },
];

/**
 * Escaparate del login: panel esmeralda que reutiliza la gema del hero.
 * Solo desktop (>= lg); en móvil el login queda como columna única.
 */
export function LoginShowcase() {
  return (
    <aside
      className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-center lg:gap-12 lg:px-14 xl:px-20"
      style={{
        background:
          "linear-gradient(155deg, #0d7351 0%, #0a5540 52%, #073c2d 100%)",
      }}
    >
      {/* Glow bronce del Boyero, en la esquina */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #c9904e, transparent 70%)" }}
      />

      <div className="relative max-w-md space-y-3">
        <p className="font-mono text-xs font-medium tracking-[0.16em] text-white/70 uppercase">
          Bernie Wallet
        </p>
        <h2 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight text-balance">
          Tus gastos se anotan solos.
        </h2>
      </div>

      <div className="relative w-full max-w-sm">
        <BalanceGem />
      </div>

      <ul className="relative space-y-3">
        {GUARANTEES.map((g) => (
          <li
            key={g.text}
            className="flex items-start gap-3 text-sm text-white/85"
          >
            <g.icon className="mt-0.5 size-4 shrink-0 text-[#e2b074]" />
            <span className="text-pretty">{g.text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

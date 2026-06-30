import { PawMark } from "@/components/brand/paw-mark";
import { formatCurrency } from "@/lib/format";

type BalanceCardProps = {
  monthLabel: string;
  total: number;
  currency?: string;
};

/** Tarjeta de saldo "metálica" — pieza protagonista premium del dashboard. */
export function BalanceCard({ monthLabel, total, currency = "PEN" }: BalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-[0_14px_34px_-14px_rgba(15,90,64,0.5)]">
      {/* Degradado esmeralda + brillo diagonal sutil (cue de tarjeta metálica) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #0f5a40 0%, #0b3f2e 100%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 38%)",
        }}
      />

      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <PawMark className="size-4 text-[#e2b074]" />
          Bernie Wallet
        </span>
        <span className="text-[10px] font-bold tracking-[0.22em] text-[#e2b074] uppercase">
          Premium
        </span>
      </div>

      <div className="relative my-4 h-px bg-[#c9904e]/50" />

      <p className="relative text-[11px] font-medium tracking-[0.14em] text-white/70 uppercase">
        Gastos · {monthLabel}
      </p>
      <p className="relative mt-1 text-4xl font-semibold tracking-tight tabular-nums">
        {formatCurrency(total, currency)}
      </p>
    </div>
  );
}

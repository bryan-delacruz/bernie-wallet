import { PawMark } from "@/components/brand/paw-mark";
import { formatCurrency } from "@/lib/format";

export type CurrencyTotal = { currency: string; total: number };

type BalanceCardProps = {
  monthLabel: string;
  /** Totales por moneda. El primero es el principal (PEN); el resto, secundarios. */
  totals: CurrencyTotal[];
};

/** Tarjeta de saldo "metálica" — pieza protagonista premium del dashboard. Bimoneda. */
export function BalanceCard({ monthLabel, totals }: BalanceCardProps) {
  const [primary = { currency: "PEN", total: 0 }, ...secondary] = totals;

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
        {formatCurrency(primary.total, primary.currency)}
      </p>

      {secondary.length > 0 && (
        <div className="relative mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          {secondary.map((t) => (
            <span key={t.currency} className="text-lg font-medium tabular-nums text-white/55">
              {formatCurrency(t.total, t.currency)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

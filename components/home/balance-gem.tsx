/** Tarjeta metálica de saldo — el objeto de lujo del hero. */
export function BalanceGem() {
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

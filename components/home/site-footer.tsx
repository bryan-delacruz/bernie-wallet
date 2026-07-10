import { BernieLogoColor } from "@/components/brand/bernie-logo";

/** Footer minimal, aterrizado en marfil más profundo. */
export function SiteFooter() {
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

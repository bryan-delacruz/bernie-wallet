import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Logo: ícono de billetera estándar (Lucide) con los colores premium de la marca.

/** Monocromo (adaptativo): hereda el color vía currentColor → sirve en light y dark. */
export function BernieLogo({ className }: { className?: string }) {
  return (
    <Wallet
      role="img"
      aria-label="Bernie Wallet"
      className={cn("size-7", className)}
    />
  );
}

/** A color de marca: billetera en esmeralda. */
export function BernieLogoColor({ className }: { className?: string }) {
  return (
    <Wallet
      role="img"
      aria-label="Bernie Wallet"
      className={cn("size-7 text-primary", className)}
    />
  );
}

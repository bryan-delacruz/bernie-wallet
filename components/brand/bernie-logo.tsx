import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Logo: ícono de billetera estándar (Lucide) con los colores premium de la marca.

// `decorative`: cuando el logo va junto al wordmark "Bernie Wallet", se marca
// aria-hidden para que el lector de pantalla no anuncie el nombre dos veces.
type LogoProps = { className?: string; decorative?: boolean };

const a11yProps = (decorative?: boolean) =>
  decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "Bernie Wallet" };

/** Monocromo (adaptativo): hereda el color vía currentColor → sirve en light y dark. */
export function BernieLogo({ className, decorative }: LogoProps) {
  return <Wallet {...a11yProps(decorative)} className={cn("size-7", className)} />;
}

/** A color de marca: billetera en esmeralda. */
export function BernieLogoColor({ className, decorative }: LogoProps) {
  return <Wallet {...a11yProps(decorative)} className={cn("size-7 text-primary", className)} />;
}

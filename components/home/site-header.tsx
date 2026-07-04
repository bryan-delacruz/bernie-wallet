import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BernieLogoColor } from "@/components/brand/bernie-logo";
import { cn } from "@/lib/utils";

/** Header marfil, elevado (frost + hairline + sombra) para no perderse con las secciones. */
export function SiteHeader() {
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

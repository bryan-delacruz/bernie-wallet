import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** CTA principal del home (hero + cierre). Hover sobrio: esmeralda más claro, sin subir. */
export function CtaButton({ className }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={cn(
        buttonVariants({ size: "lg" }),
        "group h-12 gap-2 rounded-xl bg-[#0e7c58] px-6 text-base font-medium text-white",
        "shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-[background-color,transform] duration-150 ease-out",
        "hover:bg-[#13946a] active:scale-[0.97]",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        className,
      )}
    >
      Empezar con Google
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
    </Link>
  );
}

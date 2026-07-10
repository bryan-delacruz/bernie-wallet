import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Página no encontrada</h1>
        <p className="max-w-sm text-muted-foreground">
          No encontramos esta página. Puede que el enlace haya cambiado o ya no exista.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}>
        Volver al inicio
      </Link>
    </main>
  );
}

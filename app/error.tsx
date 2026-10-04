"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Errores inesperados de cualquier página. El detalle queda en el log del servidor. */
export default function PageError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <RotateCw className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">No pudimos cargar esta página</h1>
        <p className="max-w-sm text-muted-foreground">
          Tus gastos están a salvo. Suele ser algo pasajero: vuelve a intentarlo.
        </p>
      </div>
      <Button size="lg" className="h-11 px-6" onClick={() => unstable_retry()}>
        Intentar de nuevo
      </Button>
      {error.digest && <p className="text-xs text-muted-foreground">Código: {error.digest}</p>}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { fetchStreakImage, shareBlob } from "@/lib/share-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Muestra la tarjeta **antes** de compartirla. Lo que se ve acá es el archivo que
 * se va a enviar, no una maqueta: se pide una vez y el mismo blob se previsualiza
 * y se comparte, así que no pueden desfasarse.
 */
export function ShareStreakDialog({
  open,
  onOpenChange,
  title = "Tu racha",
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let objectUrl: string | null = null;

    fetchStreakImage()
      .then((image) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(image);
        setBlob(image);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlob(null);
      setUrl(null);
      setFailed(false);
    };
  }, [open]);

  async function share() {
    if (!blob) return;
    setBusy(true);
    try {
      await shareBlob(blob);
    } catch {
      toast.error("No se pudo compartir. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-medium">{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Así se va a ver. Sin montos ni comercios."}
          </DialogDescription>
        </DialogHeader>

        {/* El alto se reserva con la proporción de la historia (9:16) para que el
            diálogo no salte cuando termina de cargar la imagen. */}
        <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-border bg-muted">
          <div className="relative aspect-[9/16]">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Vista previa de tu tarjeta de racha" className="size-full object-cover" />
            ) : (
              <p className="flex size-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                {failed ? "No se pudo preparar la imagen." : "Preparando…"}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              if (url) {
                const link = document.createElement("a");
                link.href = url;
                link.download = "bernie-racha.png";
                link.click();
              }
            }}
            disabled={!url}
          >
            <Download className="size-4" aria-hidden />
            Descargar
          </Button>
          <Button onClick={share} disabled={!blob || busy}>
            <Share2 className="size-4" aria-hidden />
            Compartir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

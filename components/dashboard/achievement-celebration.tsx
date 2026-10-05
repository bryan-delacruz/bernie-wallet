"use client";

import { useEffect, useState } from "react";
import { Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Achievement } from "@/lib/achievements";
import { shareStreakImage } from "@/lib/share-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "bernie.celebrated";

/**
 * Celebra un logro **después** de la acción del usuario, nunca antes ni encima de
 * lo que está haciendo. Tres reglas para que no sea invasivo:
 *
 * 1. Cada logro se celebra una sola vez, y eso se recuerda en el navegador.
 * 2. La primera vez no celebra nada: deja una línea base silenciosa, para no
 *    disparar varios modales seguidos por logros que el usuario ya tenía.
 * 3. Solo hitos. Lo demás vive en la tarjeta de racha, sin interrumpir.
 */
export function AchievementCelebration({ earned }: { earned: Achievement[] }) {
  const [celebrating, setCelebrating] = useState<Achievement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ids = earned.map((a) => a.id);
    let stored: string[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      stored = null; // storage bloqueado: mejor no celebrar que celebrar de más
    }

    if (stored === null) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch {}
      return;
    }

    const fresh = earned.filter((a) => !stored.includes(a.id));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
    if (fresh.length === 0) return;

    // Se deja respirar la pantalla antes de celebrar: el logro llega después de lo
    // que el usuario estaba haciendo, no encima.
    const timer = setTimeout(() => setCelebrating(fresh[fresh.length - 1]), 600);
    return () => clearTimeout(timer);
  }, [earned]);

  async function share() {
    setBusy(true);
    try {
      await shareStreakImage();
    } catch {
      toast.error("No se pudo preparar la imagen. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={celebrating !== null} onOpenChange={(open) => !open && setCelebrating(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-[#0e7c58]/10 text-[#0e7c58]">
            <Trophy className="size-5" aria-hidden />
          </span>
          <DialogTitle>{celebrating?.title}</DialogTitle>
          <DialogDescription>{celebrating?.detail}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Ahora no</DialogClose>
          <Button onClick={share} disabled={busy}>
            <Share2 className="size-4" aria-hidden />
            Compartir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

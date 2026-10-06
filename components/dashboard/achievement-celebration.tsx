"use client";

import { useEffect, useState } from "react";
import type { Achievement } from "@/lib/achievements";
import { ShareStreakDialog } from "@/components/dashboard/share-streak-dialog";

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

  return (
    <ShareStreakDialog
      open={celebrating !== null}
      onOpenChange={(open) => !open && setCelebrating(null)}
      title={celebrating?.title}
      description={celebrating?.detail}
    />
  );
}

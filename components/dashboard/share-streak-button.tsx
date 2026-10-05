"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareStreakImage } from "@/lib/share-image";

export function ShareStreakButton() {
  const [busy, setBusy] = useState(false);

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
    <Button variant="ghost" size="sm" onClick={share} disabled={busy}>
      <Share2 className="size-4" aria-hidden />
      Compartir
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareStreakDialog } from "@/components/dashboard/share-streak-dialog";

export function ShareStreakButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="size-4" aria-hidden />
        Compartir
      </Button>
      <ShareStreakDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

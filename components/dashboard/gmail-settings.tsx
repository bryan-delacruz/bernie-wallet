"use client";

import { useState, useTransition } from "react";
import { Mail, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { disconnectGmail } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type GmailStatus = "connected" | "lost" | "disconnected";

const CONNECT_URL = `/api/gmail/connect?next=${encodeURIComponent("/settings")}`;

/** Estado de Gmail en Configuración (SPEC §19.4–19.5). "lost" = hay token pero la
 *  última corrida se quedó sin acceso (lo revocó desde Google). */
export function GmailSettings({ status, email }: { status: GmailStatus; email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {status === "lost" ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#c9904e]" aria-hidden />
          ) : (
            <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {status === "connected" ? "Conectado" : status === "lost" ? "Sin acceso" : "No conectado"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {status === "connected"
                ? email
                : status === "lost"
                  ? "Tus gastos no se están anotando."
                  : "Conéctalo para que Bernie anote tus gastos."}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {status === "disconnected" ? (
            <Button size="sm" className="w-full sm:w-auto" nativeButton={false} render={<a href={CONNECT_URL} />}>
              Conectar Gmail
            </Button>
          ) : (
            <>
              {status === "lost" && (
                <Button size="sm" className="flex-1 sm:flex-none" nativeButton={false} render={<a href={CONNECT_URL} />}>
                  Reconectar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-[#b23a36] hover:text-[#b23a36] sm:flex-none"
                onClick={() => setOpen(true)}
              >
                Desconectar
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">
              ¿Desconectar Gmail?
            </DialogTitle>
            <DialogDescription>
              Bernie dejará de anotar tus gastos solo. Los que ya están se quedan, y
              puedes volver a conectarlo cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await disconnectGmail();
                  if (result?.error) {
                    toast.error(result.error);
                    return;
                  }
                  setOpen(false);
                  toast.success("Gmail desconectado.");
                })
              }
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

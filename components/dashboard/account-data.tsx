"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccount } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONFIRM_WORD = "BORRAR";

/** Mis datos: descargarlos y borrar la cuenta. Son derechos del titular, así que
 *  viven en la app y no en un correo de soporte (Ley 29733). */
export function AccountData({ canDelete }: { canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Descargar mis datos</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Un archivo JSON con tus gastos, categorías, medios de pago y retos. No
          incluye tu conexión con Gmail, que es una credencial y no un dato tuyo.
        </p>
        <Button variant="ghost" size="sm" className="mt-3" render={<a href="/api/export" download />}>
          <Download className="size-4" aria-hidden />
          Descargar
        </Button>
      </div>

      {canDelete && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Borrar mi cuenta</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se borra todo: gastos, categorías, retos y tu conexión con Gmail. No hay
            copia ni forma de recuperarlo.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-[#b23a36] hover:text-[#b23a36]"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            Borrar cuenta
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">
              Borrar tu cuenta
            </DialogTitle>
            <DialogDescription>
              Esto borra tus gastos, categorías, medios de pago y retos, y le quita a
              Bernie el acceso a tu Gmail. Es definitivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">
              Escribe {CONFIRM_WORD} para confirmar
            </Label>
            <Input
              id="confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={confirmation !== CONFIRM_WORD || pending}
              onClick={() =>
                start(async () => {
                  const result = await deleteAccount();
                  if (result?.error) toast.error(result.error);
                })
              }
            >
              {pending ? "Borrando…" : "Borrar para siempre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

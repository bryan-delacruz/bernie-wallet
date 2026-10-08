"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBankFlag } from "@/app/(admin)/admin/actions";
import { Switch } from "@/components/ui/switch";

export type AdminBank = {
  id: string;
  official_name: string;
  active: boolean;
  discovering: boolean;
};

/** Interruptores por banco. El de descubrimiento reemplaza a la variable de
 *  entorno: se enciende donde hace falta y se apaga sin desplegar (SPEC §17.6). */
export function BankFlags({ banks }: { banks: AdminBank[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {banks.map((bank) => (
        <div key={bank.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
          <span className="min-w-0 flex-1 text-sm font-medium">{bank.official_name}</span>
          <Flag bank={bank} flag="active" label="Activo" />
          <Flag
            bank={bank}
            flag="discovering"
            label="Descubrimiento"
            hint="Anota los asuntos que no reconocemos. Gasta cuota de Gmail: apágalo cuando termines de mapear."
          />
        </div>
      ))}
    </div>
  );
}

function Flag({
  bank,
  flag,
  label,
  hint,
}: {
  bank: AdminBank;
  flag: "active" | "discovering";
  label: string;
  hint?: string;
}) {
  const [on, setOn] = useState(bank[flag]);
  const [pending, start] = useTransition();

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground" title={hint}>
      <Switch
        checked={on}
        disabled={pending}
        onCheckedChange={(next: boolean) => {
          const previous = on;
          setOn(next); // optimista: el interruptor responde al toque
          start(async () => {
            const result = await setBankFlag(bank.id, flag, next);
            if (result.error) {
              setOn(previous);
              toast.error(result.error);
            }
          });
        }}
      />
      {label}
    </label>
  );
}

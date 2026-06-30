"use client";

import { useTransition } from "react";
import { Landmark } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { connectBank, disconnectBank } from "@/app/(dashboard)/settings/actions";

type Bank = { id: string; name: string; connected: boolean };

export function BankSettings({ banks }: { banks: Bank[] }) {
  const [pending, startTransition] = useTransition();

  function toggle(bank: Bank, next: boolean) {
    startTransition(async () => {
      if (next) await connectBank(bank.id, bank.name);
      else await disconnectBank(bank.id);
    });
  }

  return (
    <ul className="space-y-2">
      {banks.map((bank) => (
        <li
          key={bank.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Landmark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{bank.name}</p>
            <p className="text-sm text-muted-foreground">
              {bank.connected
                ? "Conectado · revisaremos sus correos al sincronizar"
                : "No conectado"}
            </p>
          </div>
          <Switch
            checked={bank.connected}
            onCheckedChange={(next) => toggle(bank, next)}
            disabled={pending}
            aria-label={`Conectar ${bank.name}`}
          />
        </li>
      ))}
    </ul>
  );
}

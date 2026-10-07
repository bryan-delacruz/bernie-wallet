"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Aviso de que se perdió el acceso a Gmail.
 *
 * Antes esto solo se veía al apretar "Sincronizar". Con el cron corriendo solo, el
 * usuario puede pasar días sin apretarlo: sus gastos dejan de aparecer y nada se lo
 * explica. El aviso se apoya en `sync_logs.error_code`, que la corrida fallida ya
 * deja grabado (SPEC §9.2).
 */
export function GmailReconnectBanner() {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function reconnect() {
    setWorking(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // ?reconnect=1 fuerza prompt=consent: es lo único que hace a Google emitir un
    // refresh_token nuevo, porque el login normal ya no lo pide.
    router.replace("/login?reconnect=1");
  }

  return (
    <div className="mb-6 rounded-xl border border-[#c9904e]/40 bg-[#c9904e]/10 px-4 py-3">
      {/* En móvil el botón va debajo: con el texto al costado, el aviso queda en
          una columna de dos palabras y deja de leerse. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#c9904e]" aria-hidden />
          <p className="min-w-0 text-sm">
            Bernie se quedó sin acceso a tu Gmail, así que tus gastos no se están
            anotando. Reconéctalo y sigue como antes.
          </p>
        </div>
        <Button size="sm" onClick={reconnect} disabled={working} className="w-full sm:w-auto">
          {working ? "Abriendo…" : "Reconectar Gmail"}
        </Button>
      </div>
    </div>
  );
}

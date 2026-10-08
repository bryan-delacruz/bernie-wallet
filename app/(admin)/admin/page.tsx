import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { BankFlags, type AdminBank } from "@/components/admin/bank-flags";

export const metadata = { title: "Operación · Bernie Wallet" };

const SECTION = "text-sm font-semibold tracking-wide text-muted-foreground uppercase";

type SyncHealth = {
  window_label: string;
  source: string;
  runs: number;
  failed: number;
  gmail_auth: number;
  halted: number;
  discarded: number;
  new_expenses: number;
};
type Unmapped = { sender: string; subject: string; seen: number; last_seen: string };
type Usage = {
  users_total: number;
  users_connected: number;
  users_active_7d: number;
  expenses_total: number;
  expenses_7d: number;
};

/**
 * Consola del operador (SPEC §17). Todo lo que se ve acá son **conteos**: las
 * funciones que alimentan esta página no saben devolver filas de gastos, así que
 * no hay forma de mirar el caso de un usuario concreto ni por accidente.
 *
 * La única excepción es la lista de asuntos sin mapear, que necesita el texto para
 * poder mapearlos — y viene sin saber de quién es cada correo.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: health }, { data: unmapped }, { data: usage }, { data: banks }] =
    await Promise.all([
      supabase.rpc("admin_sync_health"),
      supabase.rpc("admin_unmapped_subjects"),
      supabase.rpc("admin_usage"),
      supabase
        .from("system_banks")
        .select("id, official_name, active, discovering")
        .order("official_name"),
    ]);

  const use = (usage as Usage[] | null)?.[0];

  return (
    <div className="space-y-9">
      <h1 className="font-heading text-2xl font-medium tracking-tight">Operación</h1>

      <section className="space-y-3">
        <h2 className={SECTION}>Uso</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Usuarios" value={use?.users_total} />
          <Stat label="Con Gmail" value={use?.users_connected} />
          <Stat label="Activos 7d" value={use?.users_active_7d} />
          <Stat label="Gastos" value={use?.expenses_total} />
          <Stat label="Gastos 7d" value={use?.expenses_7d} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={SECTION}>Sincronizaciones</h2>
        {(health as SyncHealth[] | null)?.length ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <Th>Ventana</Th>
                  <Th>Origen</Th>
                  <Th>Corridas</Th>
                  <Th>Fallidas</Th>
                  <Th>Sin Gmail</Th>
                  <Th>Detenidas</Th>
                  <Th>Descartados</Th>
                  <Th>Gastos</Th>
                </tr>
              </thead>
              <tbody>
                {(health as SyncHealth[]).map((row) => (
                  <tr key={`${row.window_label}-${row.source}`} className="border-b border-border last:border-0">
                    <Td>{row.window_label}</Td>
                    <Td>{row.source}</Td>
                    <Td>{row.runs}</Td>
                    <Td danger={row.failed > 0}>{row.failed}</Td>
                    <Td danger={row.gmail_auth > 0}>{row.gmail_auth}</Td>
                    <Td danger={row.halted > 0}>{row.halted}</Td>
                    <Td>{row.discarded}</Td>
                    <Td>{row.new_expenses}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Sin sincronizaciones en los últimos 7 días.</Empty>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION}>Asuntos sin mapear</h2>
        {(unmapped as Unmapped[] | null)?.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {(unmapped as Unmapped[]).map((row) => (
              <li key={`${row.sender}-${row.subject}`} className="p-4">
                <p className="text-sm font-medium">{row.subject}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {row.sender} · {row.seen} {row.seen === 1 ? "vez" : "veces"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nada por mapear. Si esperas plantillas de un banco, enciende su
            descubrimiento aquí abajo.
          </Empty>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION}>Bancos</h2>
        <BankFlags banks={(banks ?? []) as AdminBank[]} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}

function Td({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <td className={`px-3 py-2 tabular-nums ${danger ? "font-medium text-[#b23a36]" : ""}`}>
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

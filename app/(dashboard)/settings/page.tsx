import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { BankSettings } from "@/components/dashboard/bank-settings";
import {
  PaymentMethodsSettings,
  type BankOption,
  type PaymentMethod,
} from "@/components/dashboard/payment-methods-settings";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { InstallApp } from "@/components/dashboard/install-app";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import {
  ConnectedApps,
  type ConnectedApp,
  type OrphanGrant,
} from "@/components/dashboard/connected-apps";
import { isDemoUser } from "@/lib/demo";

const SECTION_TITLE = "text-sm font-semibold tracking-wide text-muted-foreground uppercase";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  // La demo no puede conectar apps (SPEC §15.5): la sección no se muestra.
  // Se pide en paralelo con el resto, no después.
  const [{ data: systemBanks }, { data: userBanks }, { data: paymentMethods }, connected] =
    await Promise.all([
      supabase.from("system_banks").select("id, official_name").eq("active", true).order("official_name"),
      supabase.from("user_banks").select("id, system_bank_id").eq("user_id", user.id),
      supabase
        .from("payment_methods")
        .select("id, user_bank_id, type, identifier, alias")
        .eq("user_id", user.id),
      isDemoUser(user) ? null : loadConnectedApps(supabase, user.id),
    ]);

  const connectedIds = new Set((userBanks ?? []).map((b) => b.system_bank_id));
  const banks = (systemBanks ?? []).map((b) => ({
    id: b.id,
    name: b.official_name,
    connected: connectedIds.has(b.id),
  }));

  // Bancos conectados (con el id de user_banks) para asociar medios de pago.
  const bankNameById = new Map((systemBanks ?? []).map((b) => [b.id, b.official_name]));
  const connectedBanks: BankOption[] = (userBanks ?? []).map((ub) => ({
    id: ub.id,
    name: bankNameById.get(ub.system_bank_id) ?? "Banco",
  }));
  const methods = (paymentMethods ?? []) as PaymentMethod[];


  return (
    <div className="mx-auto w-full max-w-2xl space-y-9">
      <h1 className="font-heading text-2xl font-medium tracking-tight">Configuración</h1>

      <section className="space-y-3">
        <div>
          <h2 className={SECTION_TITLE}>Bancos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecta tus bancos para que revisemos sus correos al sincronizar.
          </p>
        </div>
        <BankSettings banks={banks} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className={SECTION_TITLE}>Medios de pago</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tus tarjetas y Yape. Se crean solos al sincronizar, o agrégalos a mano.
          </p>
        </div>
        <PaymentMethodsSettings banks={connectedBanks} methods={methods} />
      </section>

      {connected ? (
        <section className="space-y-3">
          <div>
            <h2 className={SECTION_TITLE}>Apps conectadas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Apps a las que diste permiso para ver gastos de algunas categorías. Solo lectura.
            </p>
          </div>
          <ConnectedApps {...connected} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className={SECTION_TITLE}>Apariencia</h2>
        <ThemeToggle />
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_TITLE}>Instalar app</h2>
        <InstallApp />
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_TITLE}>Cuenta</h2>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Sesión iniciada como</p>
            <p className="truncate font-medium">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadConnectedApps(supabase: Supabase, userId: string) {
  const [{ data: connections }, { data: shares }, { data: categories }, { data: audit }, grants] =
    await Promise.all([
      supabase
        .from("integration_connections")
        .select("client_id, client_name, created_at")
        .eq("user_id", userId)
        .order("created_at"),
      supabase.from("integration_shares").select("client_id, category_id").eq("user_id", userId),
      supabase.from("categories").select("id, name").eq("user_id", userId).order("name"),
      supabase
        .from("integration_audit")
        .select("id, client_id, action, detail, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      // API beta de Supabase: si falla (p. ej. OAuth Server apagado), solo se
      // pierde el listado de permisos huérfanos, no la sección.
      supabase.auth.oauth.listGrants().catch(() => ({ data: null })),
    ]);

  const apps: ConnectedApp[] = (connections ?? []).map((c) => ({
    clientId: c.client_id,
    name: c.client_name,
    connectedAt: c.created_at,
    sharedIds: (shares ?? []).filter((s) => s.client_id === c.client_id).map((s) => s.category_id),
    history: (audit ?? [])
      .filter((a) => a.client_id === c.client_id)
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        action: a.action,
        at: a.created_at,
        categories: Array.isArray(a.detail?.categories) ? a.detail.categories : [],
      })),
  }));

  const connectedIds = new Set(apps.map((a) => a.clientId));
  const orphanGrants: OrphanGrant[] = (grants.data ?? [])
    .filter((g) => !connectedIds.has(g.client.id))
    .map((g) => ({ clientId: g.client.id, name: g.client.name }));

  return { apps, categories: categories ?? [], orphanGrants };
}

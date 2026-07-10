import { createClient } from "@/lib/supabase/server";
import { BankSettings } from "@/components/dashboard/bank-settings";
import {
  PaymentMethodsSettings,
  type BankOption,
  type PaymentMethod,
} from "@/components/dashboard/payment-methods-settings";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { InstallApp } from "@/components/dashboard/install-app";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

const SECTION_TITLE = "text-sm font-semibold tracking-wide text-muted-foreground uppercase";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: systemBanks }, { data: userBanks }, { data: paymentMethods }] =
    await Promise.all([
      supabase.from("system_banks").select("id, official_name").eq("active", true).order("official_name"),
      supabase.from("user_banks").select("id, system_bank_id").eq("user_id", user.id),
      supabase
        .from("payment_methods")
        .select("id, user_bank_id, type, identifier, alias")
        .eq("user_id", user.id),
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

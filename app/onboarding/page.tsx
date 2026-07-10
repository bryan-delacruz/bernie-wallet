import { redirect } from "next/navigation";
import { Check, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { BernieLogoColor } from "@/components/brand/bernie-logo";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  // Sesión válida pero sin perfil = estado inválido → cerrar sesión y al login.
  if (!profile) {
    redirect("/api/auth/signout");
  }
  if (profile.onboarded_at) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-2.5">
          <BernieLogoColor className="size-7" />
          <span className="font-heading text-base font-medium tracking-tight">
            Bernie Wallet
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-balance">
            ¿Con qué banco trabajas?
          </h1>
          <p className="text-base text-muted-foreground">
            Revisaremos esos correos para anotar tus gastos por ti. Tus
            categorías ya están listas y el registro manual siempre está
            disponible.
          </p>
        </div>

        <form action={completeOnboarding} className="flex w-full flex-col gap-4">
          <p className="text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Selecciona tu banco
          </p>

          <label className="group flex cursor-pointer items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="checkbox" name="bank" value="BCP" className="sr-only" />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-has-[:checked]:bg-primary/10 group-has-[:checked]:text-primary">
              <Landmark className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-medium">BCP</span>
              <span className="block text-sm text-muted-foreground">
                Banco de Crédito del Perú
              </span>
            </span>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/40 group-has-[:checked]:border-primary group-has-[:checked]:bg-primary">
              <Check className="size-3.5 text-primary-foreground opacity-0 group-has-[:checked]:opacity-100" />
            </span>
          </label>

          <Button type="submit" size="lg" className="mt-1 h-11 w-full text-base">
            Continuar
          </Button>

          <p className="text-xs text-muted-foreground/80">
            ¿Aún no usas BCP? Solo continúa —puedes conectarlo luego en
            Configuración.
          </p>
        </form>
      </div>
    </main>
  );
}

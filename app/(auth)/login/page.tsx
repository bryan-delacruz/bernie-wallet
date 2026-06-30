import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BernieLogoColor } from "@/components/brand/bernie-logo";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex items-center gap-2.5">
        <BernieLogoColor className="size-8" />
        <span className="font-heading text-lg font-medium tracking-tight">
          Bernie Wallet
        </span>
      </div>

      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          Inicia sesión
        </h1>
        <p className="max-w-sm text-base text-muted-foreground">
          Conecta tu cuenta de Google para registrar tus gastos.
        </p>
      </div>

      <GoogleSignInButton />
    </main>
  );
}

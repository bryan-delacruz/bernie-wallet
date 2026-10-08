import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Guard del panel (SPEC §17.3). Es solo cortesía: evita mostrar una pantalla
 * inútil. La protección de verdad vive en la base — las funciones de métricas
 * validan `is_admin` por dentro y devuelven vacío a cualquier otro.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <span className="font-heading text-lg font-medium tracking-tight">
            Bernie · operación
          </span>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Volver a la app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}

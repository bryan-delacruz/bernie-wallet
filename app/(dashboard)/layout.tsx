import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  if (!profile.onboarded_at) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="overflow-x-clip px-5 pt-8 pb-24 md:pb-12 md:pl-[17rem]">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

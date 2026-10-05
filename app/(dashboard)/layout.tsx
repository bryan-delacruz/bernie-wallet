import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { isDemoUser } from "@/lib/demo";
import { AchievementCelebration } from "@/components/dashboard/achievement-celebration";
import { loadStreakContext } from "@/lib/streak-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
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

  // Los logros se calculan acá y no en cada página: así la celebración aparece
  // después de categorizar en Activity, no solo al volver al dashboard.
  const { achievements, pendingExpenses } = await loadStreakContext(user.id);

  return (
    <div className="min-h-screen">
      <DashboardNav pendingExpenses={pendingExpenses} />
      <main className="overflow-x-clip px-5 pt-8 pb-24 md:pb-12 md:pl-[17rem]">
        <div className="mx-auto w-full max-w-5xl">
          {isDemoUser(user) && (
            <p className="mb-6 rounded-xl bg-[#0e7c58]/10 px-4 py-2.5 text-sm text-[#0e7c58]">
              Estás en la demo: gastos de ejemplo, sin Gmail. Tu sesión de prueba se borra en 24 horas.
            </p>
          )}
          {children}
          <AchievementCelebration earned={achievements} />
        </div>
      </main>
    </div>
  );
}

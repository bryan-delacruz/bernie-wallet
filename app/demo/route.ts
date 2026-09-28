import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { seedDemo } from "@/lib/demo";

/**
 * "Probar la demo": crea una cuenta anónima de Supabase con gastos de ejemplo
 * y entra al dashboard. Sin Google, sin Gmail, sin contraseña.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;

  if (await getCurrentUser()) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("[demo] signInAnonymously falló:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  try {
    await seedDemo(supabase, data.user.id);
  } catch (seedError) {
    console.error("[demo] no se pudo sembrar la demo:", seedError);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}

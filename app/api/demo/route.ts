import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { seedDemo } from "@/lib/demo";

/**
 * Siembra los gastos de ejemplo en la cuenta anónima que el navegador acaba de
 * crear. Solo para anónimos y una sola vez por cuenta: llamarla de nuevo no
 * duplica nada.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.is_anonymous) {
    return NextResponse.json({ error: "Solo para la demo." }, { status: 403 });
  }

  const { data: perfil } = await supabase
    .from("users")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (perfil?.onboarded_at) return NextResponse.json({ ok: true });

  try {
    await seedDemo(supabase, user.id);
  } catch (error) {
    console.error("[demo] no se pudo sembrar la demo:", error);
    return NextResponse.json({ error: "No se pudo preparar la demo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

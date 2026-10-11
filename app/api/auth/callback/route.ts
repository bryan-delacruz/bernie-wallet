import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { seedCashPaymentMethod, seedDefaultCategories } from "@/lib/seed";
import { NEXT_COOKIE, nextFromCookie } from "@/lib/safe-next";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const next = nextFromCookie(request.cookies.get(NEXT_COOKIE)?.value);
  // Si el login falla, el reintento debe volver al mismo destino.
  const loginError = (code: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(code)}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );

  // Google devuelve ?error=access_denied si el usuario cancela el consentimiento.
  if (oauthError) {
    return loginError(oauthError);
  }
  if (!code) {
    return loginError("missing_code");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return loginError("auth");
  }

  const { user } = data;

  // Fila base de la cuenta. El token de Gmail ya no se guarda acá: el login es
  // solo identidad y Gmail se conecta aparte (SPEC §19).
  const { error: userErr } = await supabase
    .from("users")
    .upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id" });
  if (userErr) {
    console.error("[callback] users upsert falló:", userErr.message);
  }

  // Categorías por defecto siempre disponibles (manual o sync).
  await seedDefaultCategories(supabase, user.id);
  await seedCashPaymentMethod(supabase, user.id);

  // Primer login (sin onboarding) → pantalla de onboarding; si no, al dashboard.
  const { data: profile } = await supabase
    .from("users")
    .select("onboarded_at")
    .eq("id", user.id)
    .single();
  // Un `next` válido (p. ej. volver a autorizar una app) manda sobre el destino
  // por defecto; el onboarding queda para la siguiente visita al dashboard.
  const destination = next ?? (profile?.onboarded_at ? "/dashboard" : "/onboarding");

  const response = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.delete(NEXT_COOKIE);
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { seedDefaultCategories } from "@/lib/seed";
import { NEXT_COOKIE, nextFromCookie } from "@/lib/safe-next";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

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

  const { user, session } = data;

  // Fila base de la cuenta: necesaria por el FK de google_tokens.
  const { error: userErr } = await supabase
    .from("users")
    .upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id" });
  if (userErr) {
    console.error("[callback] users upsert falló:", userErr.message);
  }

  // Persistir el refresh_token de Google (cifrado) para sincronizar Gmail luego.
  const refreshToken = session.provider_refresh_token;
  if (refreshToken) {
    const { error: tokErr } = await supabase.from("google_tokens").upsert(
      {
        user_id: user.id,
        encrypted_refresh_token: encrypt(refreshToken),
        scope: GMAIL_SCOPE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (tokErr) {
      console.error("[callback] google_tokens upsert falló:", tokErr.message);
    }
  }

  // Categorías por defecto siempre disponibles (manual o sync).
  await seedDefaultCategories(supabase, user.id);

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

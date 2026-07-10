import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { seedDefaultCategories } from "@/lib/seed";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  // Google devuelve ?error=access_denied si el usuario cancela el consentimiento.
  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { user, session } = data;

  // Fila base de la cuenta: necesaria por el FK de google_tokens.
  await supabase
    .from("users")
    .upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id" });

  // Persistir el refresh_token de Google (cifrado) para sincronizar Gmail luego.
  const refreshToken = session.provider_refresh_token;
  if (refreshToken) {
    await supabase.from("google_tokens").upsert(
      {
        user_id: user.id,
        encrypted_refresh_token: encrypt(refreshToken),
        scope: GMAIL_SCOPE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  // Categorías por defecto siempre disponibles (manual o sync).
  await seedDefaultCategories(supabase, user.id);

  // Primer login (sin onboarding) → pantalla de onboarding; si no, al dashboard.
  const { data: profile } = await supabase
    .from("users")
    .select("onboarded_at")
    .eq("id", user.id)
    .single();
  const destination = profile?.onboarded_at ? "/dashboard" : "/onboarding";

  return NextResponse.redirect(`${origin}${destination}`);
}

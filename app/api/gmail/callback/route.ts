import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { revokeGoogleToken } from "@/lib/account";
import { getGmailAddress } from "@/lib/gmail/gmail-service";
import {
  GMAIL_OAUTH_COOKIE,
  GMAIL_OAUTH_COOKIE_PATH,
  GMAIL_SCOPE,
  callbackUrl,
  parseOAuthCookie,
  sameMailbox,
  withOutcome,
  type ConnectOutcome,
} from "@/lib/gmail/oauth";

export const runtime = "nodejs";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type TokenResponse = { access_token?: string; refresh_token?: string; scope?: string };

/**
 * Vuelta de Google en "Conectar Gmail" (SPEC §19.3). Valida `state`, canjea el
 * código con PKCE, exige que el Gmail sea el mismo correo del login y recién
 * entonces guarda el refresh token cifrado.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const saved = parseOAuthCookie(request.cookies.get(GMAIL_OAUTH_COOKIE)?.value);
  const next = saved?.next ?? "/activity";

  const finish = (outcome: ConnectOutcome) => {
    const response = NextResponse.redirect(`${origin}${withOutcome(next, outcome)}`);
    response.cookies.set(GMAIL_OAUTH_COOKIE, "", { path: GMAIL_OAUTH_COOKIE_PATH, maxAge: 0 });
    return response;
  };

  // Sin cookie o con otro `state`, la vuelta no la inició esta sesión (CSRF).
  if (!saved || searchParams.get("state") !== saved.state) return finish("error");
  if (searchParams.get("error") === "access_denied") return finish("denied");
  const code = searchParams.get("code");
  if (!code) return finish("error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return finish("error");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: saved.verifier,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl(origin),
    }),
  });
  if (!res.ok) {
    console.error("[gmail/callback] canje del código falló:", res.status);
    return finish("error");
  }
  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.access_token || !tokens.refresh_token) return finish("error");

  // Si destildó el permiso de Gmail en la pantalla de Google, el token no sirve.
  const scopes = (tokens.scope ?? "").split(" ");
  if (!scopes.includes(GMAIL_SCOPE)) {
    await revokeGoogleToken(tokens.refresh_token);
    return finish("denied");
  }

  const mailbox = await getGmailAddress(tokens.access_token);
  if (!mailbox || !sameMailbox(mailbox, user.email)) {
    // Otro buzón: Bernie no se queda con un acceso que no va a usar.
    await revokeGoogleToken(tokens.refresh_token);
    return finish(mailbox ? "mismatch" : "error");
  }

  const { error } = await supabase.from("google_tokens").upsert(
    {
      user_id: user.id,
      encrypted_refresh_token: encrypt(tokens.refresh_token),
      scope: GMAIL_SCOPE,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[gmail/callback] google_tokens upsert falló:", error.message);
    await revokeGoogleToken(tokens.refresh_token);
    return finish("error");
  }

  return finish("connected");
}

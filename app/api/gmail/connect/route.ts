import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import {
  GMAIL_OAUTH_COOKIE,
  GMAIL_OAUTH_COOKIE_PATH,
  GMAIL_OAUTH_MAX_AGE,
  buildAuthUrl,
  callbackUrl,
  newOAuthSecrets,
  withOutcome,
} from "@/lib/gmail/oauth";

export const runtime = "nodejs";

/**
 * Inicio de "Conectar Gmail" (SPEC §19.3): el permiso de Gmail va aparte del
 * login. Guarda `state` + verificador PKCE en una cookie corta y manda a Google.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next")) ?? "/activity";

  const user = await getCurrentUser();
  if (!user) {
    const back = `/api/gmail/connect?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(back)}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  // Sin correo (usuario anónimo de la demo) no hay buzón que comparar.
  if (!clientId || !user.email || user.is_anonymous) {
    return NextResponse.redirect(`${origin}${withOutcome(next, "error")}`);
  }

  const { state, verifier, challenge } = newOAuthSecrets();
  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId,
      redirectUri: callbackUrl(origin),
      state,
      challenge,
      loginHint: user.email,
    }),
  );
  response.cookies.set(GMAIL_OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: GMAIL_OAUTH_COOKIE_PATH,
    maxAge: GMAIL_OAUTH_MAX_AGE,
  });
  return response;
}

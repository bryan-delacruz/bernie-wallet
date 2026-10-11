import { createHash, randomBytes } from "node:crypto";

/**
 * Piezas puras del flujo "Conectar Gmail" (SPEC §19.3), sin IO: así se prueban sin
 * red. Los route handlers de `/api/gmail/*` ponen el IO alrededor.
 */

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/** Cookie que lleva `state`, el verificador PKCE y el `next` hasta el callback. */
export const GMAIL_OAUTH_COOKIE = "bw_gmail_oauth";
export const GMAIL_OAUTH_COOKIE_PATH = "/api/gmail";
export const GMAIL_OAUTH_MAX_AGE = 600;

/** Resultado que la página de destino recibe en `?gmail=`. */
export type ConnectOutcome = "connected" | "denied" | "mismatch" | "error";

export type OAuthCookie = { state: string; verifier: string; next: string };

/** `state` y verificador PKCE nuevos, con el `challenge` S256 que va a Google. */
export function newOAuthSecrets() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

/** La URI de callback sale del origen del request, no de `NEXT_PUBLIC_SITE_URL`:
 *  así el flujo vuelve a la misma app en local, en preview y en producción. Google
 *  la valida igual contra su lista de URIs autorizadas. */
export function callbackUrl(origin: string): string {
  return `${origin}/api/gmail/callback`;
}

export function buildAuthUrl(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  loginHint: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    include_granted_scopes: "true",
    // Siempre consentimiento: conectar es raro y deliberado, y es lo único que
    // garantiza que Google entregue un refresh_token.
    access_type: "offline",
    prompt: "consent",
    login_hint: p.loginHint,
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export function parseOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<OAuthCookie>;
    if (typeof v.state !== "string" || typeof v.verifier !== "string" || typeof v.next !== "string") {
      return null;
    }
    return { state: v.state, verifier: v.verifier, next: v.next };
  } catch {
    return null;
  }
}

/** Mismo buzón: sin distinguir mayúsculas, y googlemail.com es gmail.com. */
export function sameMailbox(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/@googlemail\.com$/, "@gmail.com");
  return norm(a) !== "" && norm(a) === norm(b);
}

/** Destino con el resultado en `?gmail=`, conservando la query que ya traía. */
export function withOutcome(next: string, outcome: ConnectOutcome): string {
  const url = new URL(next, "https://bernie.invalid");
  url.searchParams.set("gmail", outcome);
  return url.pathname + url.search + url.hash;
}
